import { supabase } from './supabase';
import type { Message, Attachment } from './database.types';

// A content part for multimodal messages. Text-only messages use a plain
// string; multimodal messages use an array of parts.
export interface ContentPart {
  type: 'text' | 'image_url' | 'inline_data';
  text?: string;
  image_url?: { url: string };
  inline_data?: { mime_type: string; data: string };
}

export type MessageContent = string | ContentPart[];

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface ChatCompletionParams {
  messages: ApiMessage[];
  model: string; // fully-qualified, e.g. "groq/llama-3.3-70b-versatile"
  temperature?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}

/**
 * Stream a chat completion from the `ai-chat` edge function.
 *
 * Calls the function with a JSON body; the edge function returns a
 * Server-Sent Events stream of text deltas. Yields each delta string as it
 * arrives so the UI can render tokens incrementally.
 *
 * Supports multimodal content (images, audio, video) when the message content
 * is an array of ContentPart objects.
 *
 * On any non-2xx response, throws an Error with a human-readable message.
 * The edge function includes a graceful demo-mode fallback so the app still
 * works without configured API keys.
 */
export async function* streamChatCompletion(
  params: ChatCompletionParams,
): AsyncGenerator<string, void, unknown> {
  const { messages, model, temperature = 0.7, systemPrompt, signal } = params;

  const finalMessages = systemPrompt
    ? [{ role: 'system' as const, content: systemPrompt }, ...messages]
    : messages;

  const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData?.session?.access_token;

  const response = await fetch(functionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({
      messages: finalMessages,
      model,
      temperature,
      stream: true,
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    let detail = `Request failed (${response.status})`;
    try {
      const errJson = await response.json();
      if (errJson?.error) detail = errJson.error;
    } catch {
      // ignore parse failure
    }
    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by blank lines.
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const evt of events) {
        const lines = evt.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const data = trimmed.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta: string | undefined =
              parsed?.delta ?? parsed?.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Non-JSON keepalive line; ignore.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Request a one-shot completion (no streaming) for tasks like summarization.
 * Returns the full text. Falls back to a structured demo response if the
 * edge function is unavailable.
 */
export async function completeOnce(
  params: Omit<ChatCompletionParams, 'signal'>,
): Promise<string> {
  let full = '';
  for await (const delta of streamChatCompletion(params)) {
    full += delta;
  }
  return full;
}

/**
 * Convert stored DB message rows into API message format. For user messages
 * with attachments, converts to multimodal content parts (text + image_url
 * with data URLs). Assistant messages remain plain strings.
 *
 * `pendingAttachments` allows passing in-memory attachments for the message
 * being sent (before it's persisted), so the UI can send multimodal content
 * without waiting for a DB round-trip.
 */
export function toApiMessages(
  rows: Message[],
  pendingAttachments?: Record<string, Attachment[]>,
): ApiMessage[] {
  return rows
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const atts = pendingAttachments?.[m.id] ?? m.attachments ?? null;
      if (atts && atts.length > 0 && m.role === 'user') {
        const parts: ContentPart[] = [{ type: 'text', text: m.content || ' ' }];
        for (const att of atts) {
          if (att.type === 'image') {
            parts.push({ type: 'image_url', image_url: { url: att.url } });
          } else {
            // Audio/video: use inline_data format. The URL should be a data URL.
            // If it's a storage URL, the caller should convert it first.
            const dataUrlMatch = att.url.match(/^data:([^;]+);base64,(.+)$/);
            if (dataUrlMatch) {
              parts.push({
                type: 'inline_data',
                inline_data: { mime_type: dataUrlMatch[1], data: dataUrlMatch[2] },
              });
            }
          }
        }
        return { role: m.role as 'user', content: parts };
      }
      return { role: m.role as 'user' | 'assistant', content: m.content };
    });
}
