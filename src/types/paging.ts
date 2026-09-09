export const DEFAULT_PAGE_EMOJI = '📟';
export const MAX_PAGE_MESSAGE_LENGTH = 280;

export type PageSource = 'web' | 'shortcut';

export interface NormalizedPageRequest {
  emoji: string;
  message: string;
}

export interface StoredPagePayload {
  schema_version: number;
  emoji: string;
  message: string;
  caller_email: string;
  source: PageSource;
  page_id: string;
}

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/gu;
const EMOJI = /\p{Extended_Pictographic}/u;

export function parsePageRequest(value: unknown): NormalizedPageRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const body = value as Record<string, unknown>;

  const rawEmoji = body.emoji == null ? '' : body.emoji;
  const rawMessage = body.message == null ? '' : body.message;
  if (typeof rawEmoji !== 'string' || typeof rawMessage !== 'string') return null;

  const emojiInput = rawEmoji.trim();
  let emoji = DEFAULT_PAGE_EMOJI;
  if (emojiInput) {
    const graphemes = Array.from(
      new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(emojiInput),
      ({ segment }) => segment
    );
    if (graphemes.length !== 1 || !EMOJI.test(graphemes[0])) return null;
    emoji = graphemes[0];
  }

  const message = rawMessage.replace(CONTROL_CHARS, ' ').replace(/\s+/gu, ' ').trim();
  if (message.length > MAX_PAGE_MESSAGE_LENGTH) return null;
  return { emoji, message };
}
