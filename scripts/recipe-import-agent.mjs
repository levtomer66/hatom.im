#!/usr/bin/env node
// The recipe import agent's listener (docs/superpowers/specs/2026-11-24-recipes-design.md
// § Import agent). Runs on the owner's Mac: wakes on the ntfy topic (or every
// 10 minutes), asks hatom.im whether imports are queued, and when they are runs
// Claude Code headless with agents/recipe-import/PROMPT.md and the hatom MCP
// server. One run at a time.
//
//   node scripts/recipe-import-agent.mjs          # listen
//   node scripts/recipe-import-agent.mjs --once   # process the queue and exit
//
// Config (never in the repo): ~/.config/hatom-recipes/agent.json
//   { "topic": "<RECIPES_IMPORT_TOPIC>", "apiKey": "htm_…", "site": "https://www.hatom.im",
//     "claude": "/Users/you/.local/bin/claude", "model": "opus" }   // model optional
// Claude runs as the owner's own CLI login (`claude auth login` once). An optional
// "oauthToken" (from `claude setup-token`) is used instead when set.

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PROMPT = join(here, '..', 'agents', 'recipe-import', 'PROMPT.md');
const CONFIG = process.env.HATOM_RECIPES_AGENT_CONFIG ?? join(homedir(), '.config', 'hatom-recipes', 'agent.json');
const POLL_MS = 10 * 60_000;
const RUN_TIMEOUT_MS = 20 * 60_000;
const TOOLS = ['queue', 'claim', 'complete', 'fail'].map((t) => `mcp__hatom__recipes_import_${t}`);

const cfg = JSON.parse(readFileSync(CONFIG, 'utf8'));
const site = (cfg.site ?? 'https://www.hatom.im').replace(/\/$/, '');
if (!cfg.apiKey) throw new Error(`apiKey missing in ${CONFIG}`);
const log = (...a) => console.log(new Date().toISOString(), ...a);

/** Queued request ids, straight from the MCP endpoint (no model needed to look). */
async function queued() {
  const res = await fetch(`${site}/api/mcp`, {
    method: 'POST',
    headers: { authorization: `Bearer ${cfg.apiKey}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'recipes_import_queue', arguments: {} } }),
    signal: AbortSignal.timeout(20_000),
  });
  const j = await res.json();
  const text = j.result?.content?.[0]?.text ?? '';
  if (j.result?.isError || !res.ok) throw new Error(`queue: ${res.status} ${text || JSON.stringify(j.error)}`);
  return /^[0-9a-f]{24}$/m.test(text) ? text.split('\n').filter((l) => /^[0-9a-f]{24}$/.test(l)) : [];
}

function runClaude() {
  const dir = mkdtempSync(join(tmpdir(), 'hatom-recipes-'));
  const mcp = join(dir, 'mcp.json');
  writeFileSync(mcp, JSON.stringify({
    mcpServers: { hatom: { type: 'http', url: `${site}/api/mcp`, headers: { Authorization: `Bearer ${cfg.apiKey}` } } },
  }), { mode: 0o600 });
  const args = [
    '-p', 'Process the recipe import queue now, following your instructions.',
    '--append-system-prompt', readFileSync(PROMPT, 'utf8'),
    '--mcp-config', mcp, '--strict-mcp-config',
    '--allowedTools', [...TOOLS, 'WebFetch', 'WebSearch'].join(','),
    ...(cfg.model ? ['--model', cfg.model] : []),
  ];
  return new Promise((resolve) => {
    const env = cfg.oauthToken ? { ...process.env, CLAUDE_CODE_OAUTH_TOKEN: cfg.oauthToken } : process.env;
    const child = spawn(cfg.claude ?? 'claude', args, { stdio: ['ignore', 'inherit', 'inherit'], cwd: dir, env });
    const timer = setTimeout(() => { log('run timed out'); child.kill('SIGTERM'); }, RUN_TIMEOUT_MS);
    child.on('exit', (code) => {
      clearTimeout(timer);
      rmSync(dir, { recursive: true, force: true });
      log(`claude exited ${code}`);
      resolve();
    });
  });
}

let running = false;
let again = false;
async function kick(why) {
  if (running) { again = true; return; }
  running = true;
  try {
    do {
      again = false;
      const ids = await queued();
      if (!ids.length) break;
      log(`${why}: ${ids.length} queued (${ids.join(', ')})`);
      await runClaude();
    } while (again);
  } catch (error) {
    log('kick failed:', error.message);
  } finally {
    running = false;
  }
}

/** The topic's JSON stream; any message is a wake-up (it carries only a request id). */
async function listen() {
  for (let wait = 1000; ; wait = Math.min(wait * 2, 60_000)) {
    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(cfg.topic)}/json`);
      if (!res.ok || !res.body) throw new Error(`ntfy ${res.status}`);
      log('listening');
      wait = 1000;
      let buf = '';
      for await (const chunk of res.body) {
        buf += Buffer.from(chunk).toString('utf8');
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl);
          buf = buf.slice(nl + 1);
          try { if (JSON.parse(line).event === 'message') void kick('ntfy'); } catch { /* keepalive or junk */ }
        }
      }
    } catch (error) {
      log('ntfy stream ended:', error.message);
    }
    await new Promise((r) => setTimeout(r, wait));
  }
}

if (process.argv.includes('--once')) {
  await kick('once');
} else {
  if (!cfg.topic) throw new Error(`topic missing in ${CONFIG}`);
  void kick('start');
  setInterval(() => void kick('poll'), POLL_MS);
  await listen();
}
