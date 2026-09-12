import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse, after } from 'next/server';
import { getApiKeyOwner, isApiKeyFormat, type ApiKeyOwner } from '@/models/UserApiSettings';
import { getAuthorizedEmailEntry } from '@/models/AuthorizedEmail';
import { isOwnerEmail } from '@/types/auth';
import type { PermissionKey } from '@/types/permissions';
import { createCoffeeOrder } from '@/models/CoffeeOrder';
import { getCoffeeFavoritesForUser, getCoffeeFavoriteForUser } from '@/models/CoffeeFavorite';
import { orderDtoFromFavorite, defaultDrinkConfig, drinkSummary } from '@/types/coffee-order';
import { notifyCoffeeOrder } from '@/lib/coffee-notify';
import { createPageIncident } from '@/lib/pagerduty';
import { parsePageRequest } from '@/types/paging';
import {
  getListsForMember,
  getListById,
  getTasksForList,
  createTask,
  updateTask,
} from '@/models/Todo';
import { normalizeColumn } from '@/types/todo';
import { getAllCoffeeReviews } from '@/models/CoffeeReview';
import { scoreReview } from '@/types/coffee';
import { getAllSpaSessions, createSpaSession } from '@/models/SpaSession';
import {
  spaUserIdFromEmail,
  otherSpaUser,
  getSpaUser,
  isValidSpaDuration,
  clampSpicyFlags,
  coerceFlags,
} from '@/types/spa';

// Remote HTTP MCP server for AI clients (Claude etc.). Hand-rolled JSON-RPC 2.0
// over POST — a stateless tools server, no SSE. Auth is the same personal API
// key as the Shortcuts/API (`Authorization: Bearer htm_…`); every tool checks
// the key owner's LIVE page permission, so a key never does more than the
// person can on the web.
export const runtime = 'nodejs';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'hatom.im', version: '1.0.0' };

async function hasPermission(email: string, permission: PermissionKey): Promise<boolean> {
  if (isOwnerEmail(email)) return true;
  const entry = await getAuthorizedEmailEntry(email);
  return entry?.allowedPages.includes(permission) === true;
}

// A tool's handler returns human-readable text; throwing yields an isError
// result so the model sees the failure instead of the request 500-ing.
interface McpTool {
  name: string;
  description: string;
  permission: PermissionKey;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>, caller: ApiKeyOwner) => Promise<string>;
}

function str(args: Record<string, unknown>, key: string): string | undefined {
  const v = args[key];
  return typeof v === 'string' ? v : undefined;
}

async function requireMember(listId: string, email: string) {
  const list = await getListById(listId);
  if (!list || !list.members.includes(email)) return null;
  return list;
}

const TOOLS: McpTool[] = [
  {
    name: 'order_coffee',
    description:
      "Order the caller's default coffee favorite now (or built-in defaults if none is set). Lands on the barista board and pushes a notification.",
    permission: 'coffee-order',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const fav = caller.defaultCoffeeFavoriteId
        ? await getCoffeeFavoriteForUser(caller.defaultCoffeeFavoriteId, caller.userEmail)
        : null;
      const dto = fav
        ? orderDtoFromFavorite(fav)
        : { ...defaultDrinkConfig(), deliveryType: 'now' as const };
      const order = await createCoffeeOrder({
        userEmail: caller.userEmail,
        userName: caller.userName,
        ...dto,
      });
      after(() => notifyCoffeeOrder(order));
      return `Ordered: ${drinkSummary(order)}`;
    },
  },
  {
    name: 'list_coffee_favorites',
    description: "List the caller's saved coffee favorites (id, name, drink summary).",
    permission: 'coffee-order',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const favs = await getCoffeeFavoritesForUser(caller.userEmail);
      if (favs.length === 0) return 'No saved favorites.';
      return favs.map((f) => `- ${f.id}: ${f.name} (${drinkSummary(f)})`).join('\n');
    },
  },
  {
    name: 'send_page',
    description: 'Send a high-urgency page (PagerDuty incident) with an emoji and a short message.',
    permission: 'paging',
    inputSchema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Message, up to 280 characters.' },
        emoji: { type: 'string', description: 'A single emoji (optional, default 📟).' },
      },
      required: ['message'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const page = parsePageRequest({ emoji: str(args, 'emoji') ?? '', message: str(args, 'message') ?? '' });
      if (!page) throw new Error('Use one emoji and a message of at most 280 characters.');
      await createPageIncident({
        ...page,
        pageId: randomUUID(),
        callerEmail: caller.userEmail,
        source: 'shortcut',
      });
      return `Paged: ${page.emoji} ${page.message}`;
    },
  },
  {
    name: 'list_todo_lists',
    description: 'List the to-do lists the caller is a member of (id and name).',
    permission: 'todo',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      const lists = await getListsForMember(caller.userEmail);
      if (lists.length === 0) return 'No lists.';
      return lists.map((l) => `- ${l.id}: ${l.name}`).join('\n');
    },
  },
  {
    name: 'list_todo_tasks',
    description: 'List the tasks in one to-do list (id, text, done).',
    permission: 'todo',
    inputSchema: {
      type: 'object',
      properties: { listId: { type: 'string' } },
      required: ['listId'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const listId = str(args, 'listId');
      if (!listId || !(await requireMember(listId, caller.userEmail))) {
        throw new Error('List not found.');
      }
      const tasks = await getTasksForList(listId);
      if (tasks.length === 0) return 'No tasks.';
      return tasks.map((t) => `- ${t.id}: [${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
    },
  },
  {
    name: 'add_todo_task',
    description: 'Add a task to a to-do list. column 0 = right/first, 1 = left/second.',
    permission: 'todo',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string' },
        text: { type: 'string' },
        column: { type: 'number', enum: [0, 1] },
      },
      required: ['listId', 'text'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const listId = str(args, 'listId');
      const text = str(args, 'text');
      if (!listId || !(await requireMember(listId, caller.userEmail))) throw new Error('List not found.');
      if (!text || !text.trim()) throw new Error('Task text is required.');
      const task = await createTask(listId, {
        text: text.trim(),
        column: normalizeColumn(args.column),
        assignees: [],
        createdBy: caller.userEmail,
      });
      return `Added task ${task.id}: ${task.text}`;
    },
  },
  {
    name: 'complete_todo_task',
    description: 'Mark a task done (or not done with done=false).',
    permission: 'todo',
    inputSchema: {
      type: 'object',
      properties: {
        listId: { type: 'string' },
        taskId: { type: 'string' },
        done: { type: 'boolean' },
      },
      required: ['listId', 'taskId'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const listId = str(args, 'listId');
      const taskId = str(args, 'taskId');
      if (!listId || !(await requireMember(listId, caller.userEmail))) throw new Error('List not found.');
      if (!taskId) throw new Error('taskId is required.');
      const done = typeof args.done === 'boolean' ? args.done : true;
      const task = await updateTask(listId, taskId, { done, doneBy: caller.userEmail });
      if (!task) throw new Error('Task not found.');
      return `Task ${task.id} marked ${task.done ? 'done' : 'not done'}.`;
    },
  },
  {
    name: 'list_coffee_reviews',
    description: 'List café coffee reviews (place name and combined score), best first.',
    permission: 'mekafkefim',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async () => {
      const reviews = await getAllCoffeeReviews();
      if (reviews.length === 0) return 'No reviews.';
      return reviews
        .sort((a, b) => scoreReview(b).combined - scoreReview(a).combined)
        .map((r) => `- ${r.placeName}: ${scoreReview(r).combined.toFixed(1)}`)
        .join('\n');
    },
  },
  {
    name: 'list_spa_sessions',
    description: 'List scheduled/past spa sessions (giver → receiver, when, duration). SPA users only.',
    permission: 'spa',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, caller) => {
      if (!spaUserIdFromEmail(caller.userEmail)) throw new Error('Not a spa user.');
      const sessions = await getAllSpaSessions();
      if (sessions.length === 0) return 'No spa sessions.';
      return sessions
        .map(
          (s) =>
            `- ${getSpaUser(s.giverId).name} → ${getSpaUser(s.receiverId).name}, ${s.scheduledAt}, ${s.durationMinutes}min`
        )
        .join('\n');
    },
  },
  {
    name: 'book_spa_session',
    description:
      'Book a spa session. The caller is the receiver; the other spa user is the giver. SPA users only.',
    permission: 'spa',
    inputSchema: {
      type: 'object',
      properties: {
        scheduledAt: { type: 'string', description: 'ISO date-time.' },
        durationMinutes: { type: 'number', enum: [30, 60, 90] },
        preferences: { type: 'string' },
        happyEnding: { type: 'boolean' },
      },
      required: ['scheduledAt', 'durationMinutes'],
      additionalProperties: false,
    },
    handler: async (args, caller) => {
      const receiverId = spaUserIdFromEmail(caller.userEmail);
      if (!receiverId) throw new Error('Not a spa user.');
      const durationMinutes = args.durationMinutes;
      if (!isValidSpaDuration(durationMinutes)) {
        throw new Error('durationMinutes must be 30, 60, or 90.');
      }
      const scheduledAt = str(args, 'scheduledAt');
      if (!scheduledAt || Number.isNaN(new Date(scheduledAt).getTime())) {
        throw new Error('scheduledAt must be a valid date-time.');
      }
      const happyEnding = args.happyEnding === true;
      const session = await createSpaSession({
        giverId: otherSpaUser(receiverId),
        scheduledAt,
        durationMinutes,
        flags: clampSpicyFlags(coerceFlags(args.flags), happyEnding),
        preferences: (str(args, 'preferences') ?? '').slice(0, 2000),
        happyEnding,
      });
      return `Booked spa: ${getSpaUser(session.giverId).name} → ${getSpaUser(session.receiverId).name}, ${session.scheduledAt}, ${session.durationMinutes}min`;
    },
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((t) => [t.name, t]));

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

function result(id: JsonRpcRequest['id'], value: unknown) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, result: value });
}
function rpcError(id: JsonRpcRequest['id'], code: number, message: string) {
  return NextResponse.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

async function resolveCaller(request: NextRequest): Promise<ApiKeyOwner | null> {
  const authorization = request.headers.get('authorization') ?? '';
  const spaceIndex = authorization.indexOf(' ');
  if (spaceIndex === -1 || authorization.slice(0, spaceIndex).toLowerCase() !== 'bearer') return null;
  const key = authorization.slice(spaceIndex + 1).trim();
  if (!isApiKeyFormat(key)) return null;
  const owner = await getApiKeyOwner(key);
  return owner?.apiKey ? owner : null;
}

export async function POST(request: NextRequest) {
  const caller = await resolveCaller(request);
  if (!caller) {
    return NextResponse.json(
      { jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } },
      { status: 401 }
    );
  }

  let body: JsonRpcRequest;
  try {
    body = (await request.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const { id, method } = body;

  // Notifications (no id) get an empty 202 — the client expects no response.
  if (id === undefined || id === null) {
    return new NextResponse(null, { status: 202 });
  }

  switch (method) {
    case 'initialize':
      return result(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return result(id, {});
    case 'tools/list':
      return result(id, {
        tools: TOOLS.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
    case 'tools/call': {
      const params = body.params ?? {};
      const name = typeof params.name === 'string' ? params.name : '';
      const args = (params.arguments as Record<string, unknown>) ?? {};
      const tool = TOOL_BY_NAME.get(name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);
      if (!(await hasPermission(caller.userEmail, tool.permission))) {
        return result(id, {
          content: [{ type: 'text', text: `You don't have the "${tool.permission}" permission.` }],
          isError: true,
        });
      }
      try {
        const text = await tool.handler(args, caller);
        return result(id, { content: [{ type: 'text', text }] });
      } catch (error) {
        return result(id, {
          content: [{ type: 'text', text: error instanceof Error ? error.message : 'Tool failed' }],
          isError: true,
        });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// No server-initiated SSE stream — this is a stateless POST tools server.
export function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
