import type { Message, Attachment } from './database.types';

export interface ContentPart {
  type: 'text' | 'image_url' | 'inline_data';
  text?: string;
  image_url?: { url: string };
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

export type MessageContent = string | ContentPart[];

export interface ApiMessage {
  role: 'system' | 'user' | 'assistant';
  content: MessageContent;
}

export interface ChatCompletionParams {
  messages: ApiMessage[];
  model: string;
  temperature?: number;
  systemPrompt?: string;
  signal?: AbortSignal;
}

export async function* streamChatCompletion(
  params: ChatCompletionParams,
): AsyncGenerator<string, void, unknown> {
  const {
    messages,
    model,
    temperature = 0.7,
    systemPrompt,
    signal,
  } = params;

  const finalMessages = systemPrompt
    ? [
        {
          role: 'system' as const,
          content: systemPrompt,
        },
        ...messages,
      ]
    : messages;

  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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
      const data = await response.json();
      if (data?.error) detail = data.error;
    } catch {}

    throw new Error(detail);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          const trimmed = line.trim();

          if (!trimmed.startsWith('data:')) continue;

          const data = trimmed.slice(5).trim();

          if (data === '[DONE]') return;

          try {
            const parsed = JSON.parse(data);
            const delta =
              parsed?.delta ??
              parsed?.choices?.[0]?.delta?.content;

            if (delta) yield delta;
          } catch {}
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function completeOnce(
  params: Omit<ChatCompletionParams, 'signal'>,
): Promise<string> {
  let full = '';

  for await (const delta of streamChatCompletion(params)) {
    full += delta;
  }

  return full;
}

export function toApiMessages(
  rows: Message[],
  pendingAttachments?: Record<string, Attachment[]>,
): ApiMessage[] {
  return rows
    .filter(
      (m) =>
        m.role === 'user' ||
        m.role === 'assistant',
    )
    .map((m) => {
      const atts =
        pendingAttachments?.[m.id] ??
        m.attachments ??
        null;

      if (
        atts &&
        atts.length > 0 &&
        m.role === 'user'
      ) {
        const parts: ContentPart[] = [
          {
            type: 'text',
            text: m.content || ' ',
          },
        ];

        for (const att of atts) {
          if (att.type === 'image') {
            parts.push({
              type: 'image_url',
              image_url: {
                url: att.url,
              },
            });
          }
        }

        return {
          role: 'user' as const,
          content: parts,
        };
      }

      return {
        role: m.role as 'user' | 'assistant',
        content: m.content,
      };
    });
    }
