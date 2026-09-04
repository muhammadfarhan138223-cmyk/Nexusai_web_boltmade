// Nexus AI — chat completion edge function
// Supports Groq, Gemini, and OpenRouter with Server-Sent Events streaming.
// Supports multimodal content (images, audio, video) for Gemini models.
//
// Provider API keys are resolved in order:
//   1. Edge-function environment secrets (GROQ_API_KEY / GEMINI_API_KEY / OPENROUTER_API_KEY)
//   2. The `ai_provider_keys` table (RLS-locked, service-role only)
// If neither is configured, a demo-mode response is streamed so the app
// remains usable for evaluation.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// A message content part. For text-only messages, content is a string.
// For multimodal, content is an array of parts.
interface ContentPart {
  type: "text" | "image_url" | "inline_data";
  text?: string;
  image_url?: { url: string };
  inline_data?: { mime_type: string; data: string };
}

interface IncomingMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

interface RequestBody {
  messages: IncomingMessage[];
  model: string; // "provider/model-id"
  temperature?: number;
  stream?: boolean;
}

// Map a fully-qualified Nexus model id to provider + upstream model id.
function parseModel(id: string): { provider: string; modelId: string } {
  const idx = id.indexOf("/");
  if (idx === -1) return { provider: "groq", modelId: id };
  const provider = id.slice(0, idx);
  // The remainder may itself contain slashes (e.g. openrouter/openai/gpt-4o-mini).
  const modelId = id.slice(idx + 1);
  return { provider, modelId };
}

function sseData(obj: unknown): string {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Check if a message has multimodal content (array with non-text parts).
function isMultimodal(msg: IncomingMessage): boolean {
  return Array.isArray(msg.content) && msg.content.some(
    (p) => p.type === "image_url" || p.type === "inline_data",
  );
}

// Check if any message in the body has multimodal content.
function hasMultimodal(body: RequestBody): boolean {
  return body.messages.some(isMultimodal);
}

// Convert data URL "data:image/png;base64,XXXX" to { mimeType, data }
function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

// ---------- Provider request builders ----------

function buildGroqRequest(body: RequestBody, apiKey: string): Request {
  const { modelId } = parseModel(body.model);
  return new Request("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      stream: body.stream !== false,
    }),
  });
}

function buildOpenRouterRequest(body: RequestBody, apiKey: string): Request {
  const { modelId } = parseModel(body.model);
  return new Request("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "https://nexusai.app",
      "X-Title": "Nexus AI",
    },
    body: JSON.stringify({
      model: modelId,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      stream: body.stream !== false,
    }),
  });
}

// Gemini: OpenAI-compatible endpoint v1beta/openai — accepts the same SSE shape.
// Used for text-only and image_url content (OpenAI-compatible format).
function buildGeminiOpenAIRequest(body: RequestBody, apiKey: string): Request {
  const { modelId } = parseModel(body.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/openai/chat/completions`;
  return new Request(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelId,
      messages: body.messages,
      temperature: body.temperature ?? 0.7,
      stream: body.stream !== false,
    }),
  });
}

// Gemini: Native API for multimodal (audio/video) content using inlineData.
// Converts our content parts to Gemini's native format:
//   text → { text: "..." }
//   inline_data → { inlineData: { mimeType, data } }
//   image_url (data URL) → { inlineData: { mimeType, data } }
function buildGeminiNativeRequest(body: RequestBody, apiKey: string): Request {
  const { modelId } = parseModel(body.model);

  // Convert messages to Gemini native format.
  // Gemini native API uses "contents" array with role "user"/"model".
  // System messages become the first user turn's text prefix.
  const contents: Array<{
    role: string;
    parts: Array<Record<string, unknown>>;
  }> = [];

  let systemText = "";
  for (const msg of body.messages) {
    if (msg.role === "system") {
      // Collect system text to prepend.
      if (typeof msg.content === "string") {
        systemText += (systemText ? "\n" : "") + msg.content;
      }
      continue;
    }

    const geminiRole = msg.role === "assistant" ? "model" : "user";
    const parts: Array<Record<string, unknown>> = [];

    if (typeof msg.content === "string") {
      parts.push({ text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content) {
        if (part.type === "text" && part.text) {
          parts.push({ text: part.text });
        } else if (part.type === "inline_data" && part.inline_data) {
          parts.push({
            inlineData: {
              mimeType: part.inline_data.mime_type,
              data: part.inline_data.data,
            },
          });
        } else if (part.type === "image_url" && part.image_url) {
          const parsed = parseDataUrl(part.image_url.url);
          if (parsed) {
            parts.push({
              inlineData: {
                mimeType: parsed.mimeType,
                data: parsed.data,
              },
            });
          }
        }
      }
    }

    if (parts.length > 0) {
      contents.push({ role: geminiRole, parts });
    }
  }

  // Prepend system text to the first user message.
  if (systemText && contents.length > 0 && contents[0].role === "user") {
    contents[0].parts.unshift({ text: systemText });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent`;
  const reqBody: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: body.temperature ?? 0.7,
    },
  };

  return new Request(`${url}?alt=sse`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(reqBody),
  });
}

// ---------- SSE pipe-through ----------

// Pipe OpenAI-compatible SSE (used by Groq, OpenRouter, Gemini OpenAI endpoint).
async function pipeSSE(
  upstream: Response,
  downstreamStream: WritableStream<Uint8Array>,
): Promise<void> {
  if (!upstream.body) throw new Error("Upstream returned no body");
  const reader = upstream.body.getReader();
  const writer = downstreamStream.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const lines = evt.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const delta = parsed?.choices?.[0]?.delta?.content;
            if (delta) {
              await writer.write(encoder.encode(sseData({ delta })));
            }
          } catch {
            // ignore non-JSON keepalives
          }
        }
      }
    }
    await writer.write(encoder.encode("data: [DONE]\n\n"));
  } finally {
    try {
      writer.close();
    } catch {
      // already closed
    }
    reader.releaseLock();
  }
}

// Pipe Gemini native SSE format. Gemini native streaming sends events like:
//   data: {"candidates":[{"content":{"parts":[{"text":"Hello"}],"role":"model"}}]}
// We extract the text delta and normalize to our { delta } shape.
async function pipeGeminiNativeSSE(
  upstream: Response,
  downstreamStream: WritableStream<Uint8Array>,
): Promise<void> {
  if (!upstream.body) throw new Error("Upstream returned no body");
  const reader = upstream.body.getReader();
  const writer = downstreamStream.getWriter();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const evt of events) {
        const lines = evt.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") {
            await writer.write(encoder.encode("data: [DONE]\n\n"));
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              await writer.write(encoder.encode(sseData({ delta: text })));
            }
          } catch {
            // ignore non-JSON keepalives
          }
        }
      }
    }
    await writer.write(encoder.encode("data: [DONE]\n\n"));
  } finally {
    try {
      writer.close();
    } catch {
      // already closed
    }
    reader.releaseLock();
  }
}

// ---------- Demo fallback ----------

function demoResponse(body: RequestBody): string {
  const last = [...body.messages].reverse().find((m) => m.role === "user");
  let q = "";
  if (typeof last?.content === "string") {
    q = last.content.trim();
  } else if (Array.isArray(last?.content)) {
    q = last.content.find((p) => p.type === "text")?.text?.trim() ?? "";
  }
  const lower = q.toLowerCase();

  if (!q) {
    return "Hi! I'm Nexus AI. Ask me anything — I can help you write, summarize, brainstorm, code, and more.";
  }

  if (lower.includes("summar") || lower.includes("tldr")) {
    return [
      "Here's a quick summary:",
      "",
      "1. **Key point** — the main idea you shared.",
      "2. **Supporting detail** — context that reinforces it.",
      "3. **Takeaway** — what to do next.",
      "",
      "_Demo mode: connect an API key (Groq / Gemini / OpenRouter) in your Supabase edge-function secrets to unlock live AI responses._",
    ].join("\n");
  }

  return [
    `Great question about "${q.slice(0, 80)}".`,
    "",
    "Here's how I'd approach it:",
    "",
    "- **Understand the goal** — clarify what success looks like.",
    "- **Break it down** — split the problem into small, testable steps.",
    "- **Iterate** — ship a rough version, then refine based on feedback.",
    "",
    "_Demo mode: add a provider API key (Groq / Gemini / OpenRouter) in your Supabase edge-function secrets to get live AI answers._",
  ].join("\n");
}

async function streamDemo(
  text: string,
  downstreamStream: WritableStream<Uint8Array>,
): Promise<void> {
  const writer = downstreamStream.getWriter();
  const encoder = new TextEncoder();
  const tokens = text.split(/(\s+)/);
  for (const t of tokens) {
    await writer.write(encoder.encode(sseData({ delta: t })));
    await new Promise((r) => setTimeout(r, 18));
  }
  await writer.write(encoder.encode("data: [DONE]\n\n"));
  writer.close();
}

// ---------- Provider key resolution ----------

async function resolveProviderKey(provider: string): Promise<{ key: string; source: string } | null> {
  const GROQ_KEY = Deno.env.get("GROQ_API_KEY");
  const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY");
  const OR_KEY = Deno.env.get("OPENROUTER_API_KEY");
  const envKeyFor: Record<string, string | undefined> = {
    groq: GROQ_KEY,
    gemini: GEMINI_KEY,
    openrouter: OR_KEY,
  };
  if (envKeyFor[provider]) {
    return { key: envKeyFor[provider] as string, source: "env" };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for key lookup");
    return null;
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/ai_provider_keys?select=api_key&provider=eq.${encodeURIComponent(provider)}&enabled=eq.true&limit=1`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!res.ok) {
      console.warn(`Key table lookup failed: ${res.status} ${await res.text().catch(() => "")}`);
      return null;
    }
    const rows = (await res.json()) as { api_key: string }[];
    if (rows[0]?.api_key) {
      return { key: rows[0].api_key, source: "db" };
    }
    return null;
  } catch (e) {
    console.warn("Key table lookup error:", e);
    return null;
  }
}

// ---------- Handler ----------

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonError(405, "Method not allowed. Use POST.");
  }

  try {
    const body = (await req.json()) as RequestBody;

    if (!body?.messages?.length) {
      return jsonError(400, "Missing 'messages'.");
    }
    if (!body?.model) {
      return jsonError(400, "Missing 'model'.");
    }

    const { provider } = parseModel(body.model);
    const stream = body.stream !== false;
    const multimodal = hasMultimodal(body);

    const resolved = await resolveProviderKey(provider);

    // --- Demo fallback when no key is configured ---
    if (!resolved) {
      if (!stream) {
        return new Response(JSON.stringify({ content: demoResponse(body) }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      streamDemo(demoResponse(body), writable).catch((e) =>
        console.error("demo stream error", e),
      );
      return new Response(readable, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const apiKey = resolved.key;
    console.log(`Using ${provider} key from ${resolved.source}${multimodal ? " (multimodal)" : ""}`);

    // --- Live provider call ---
    let upstream: Response;
    if (provider === "groq") {
      upstream = await fetch(buildGroqRequest(body, apiKey));
    } else if (provider === "openrouter") {
      upstream = await fetch(buildOpenRouterRequest(body, apiKey));
    } else if (provider === "gemini") {
      if (multimodal) {
        // Use native Gemini API for audio/video inline data.
        upstream = await fetch(buildGeminiNativeRequest(body, apiKey));
      } else {
        // Use OpenAI-compatible endpoint for text and image_url content.
        upstream = await fetch(buildGeminiOpenAIRequest(body, apiKey));
      }
    } else {
      return jsonError(400, `Unknown provider: ${provider}`);
    }

    if (!upstream.ok) {
      const errText = await upstream.text();
      return jsonError(
        502,
        `AI provider (${provider}) error ${upstream.status}: ${errText.slice(0, 300)}`,
      );
    }

    if (!stream || !upstream.body) {
      // Non-streaming: pass JSON through with normalized shape.
      const data = await upstream.json();
      let content = data?.choices?.[0]?.message?.content ?? "";
      if (!content && data?.candidates?.[0]?.content?.parts) {
        content = data.candidates[0].content.parts
          .map((p: { text?: string }) => p.text ?? "")
          .join("");
      }
      return new Response(JSON.stringify({ content }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Streaming: normalize upstream SSE to our { delta } shape.
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    if (provider === "gemini" && multimodal) {
      pipeGeminiNativeSSE(upstream, writable).catch((e) =>
        console.error("gemini native sse pipe error", e),
      );
    } else {
      pipeSSE(upstream, writable).catch((e) =>
        console.error("sse pipe error", e),
      );
    }
    return new Response(readable, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return jsonError(500, message);
  }
});
