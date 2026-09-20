export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
    });
  }

  const {
    messages = [],
    model ='groq/openai/gpt-oss-120b',
    temperature = 0.7,
  } = req.body || {};

  const [provider, ...modelParts] = String(model).split('/');
  const upstreamModel = modelParts.join('/');

  let apiKey = '';

  if (provider === 'groq') {
    apiKey = process.env.GROQ_API_KEY || '';
  } else if (provider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || '';
  } else if (provider === 'openrouter') {
    apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  if (!apiKey) {
    return res.status(500).json({
      error: `${provider} API key is not configured on Vercel.`,
    });
  }

  try {
    if (provider === 'gemini') {
      return await handleGemini(
        res,
        apiKey,
        upstreamModel,
        messages,
        temperature,
      );
    }

    return await handleOpenAICompatible(
      res,
      apiKey,
      provider,
      upstreamModel,
      messages,
      temperature,
    );
  } catch (error: any) {
    return res.status(500).json({
      error:
        error?.message ||
        'AI request failed.',
    });
  }
}

async function handleOpenAICompatible(
  res: any,
  apiKey: string,
  provider: string,
  model: string,
  messages: any[],
  temperature: number,
) {
  const url =
    provider === 'groq'
      ? 'https://api.groq.com/openai/v1/chat/completions'
      : 'https://openrouter.ai/api/v1/chat/completions';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === 'openrouter') {
    headers['HTTP-Referer'] = 'https://nexus-ai-web.vercel.app';
    headers['X-Title'] = 'Nexus AI';
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      stream: true,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(response.status).json({
      error: text || 'Upstream AI error.',
    });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body?.getReader();

  if (!reader) {
    return res.status(500).json({
      error: 'AI stream unavailable.',
    });
  }

  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;

      const chunk = decoder.decode(value, {
        stream: true,
      });

      res.write(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  res.write('data: [DONE]\\n\\n');
  res.end();
}

async function handleGemini(
  res: any,
  apiKey: string,
  model: string,
  messages: any[],
  temperature: number,
) {
  const systemText = messages
    .filter((m: any) => m.role === 'system')
    .map((m: any) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean)
    .join('\n\n');
  
  const contents = messages
    .filter(
      (m: any) =>
        m.role === 'user' ||
        m.role === 'assistant',
    )
    .map((m: any) => ({
      role:
        m.role === 'assistant'
          ? 'model'
          : 'user',
      parts: convertGeminiParts(m.content),
    }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model,
    )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(
      apiKey,
    )}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: 2048,
      stream: true,
    }),
        generationConfig: {
          temperature,
          maxOutputTokens: 4096,
        },
      }),
    },
  );

  if (!response.ok) {
    const text = await response.text();

    return res.status(response.status).json({
      error: text || 'Gemini API error.',
    });
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const reader = response.body?.getReader();

  if (!reader) {
    return res.status(500).json({
      error: 'Gemini stream unavailable.',
    });
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } =
        await reader.read();

      if (done) break;

      buffer += decoder.decode(value, {
        stream: true,
      });

      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const line = event
          .split('\n')
          .find((x) =>
            x.trim().startsWith('data:'),
          );

        if (!line) continue;

        const raw = line
          .trim()
          .slice(5)
          .trim();

        if (!raw) continue;

        try {
          const data = JSON.parse(raw);

          const text =
            data?.candidates?.[0]?.content
              ?.parts?.[0]?.text;

          if (text) {
            res.write(
              `data: ${JSON.stringify({
                delta: text,
              })}\n\n`,
            );
          }
        } catch {}
      }
    }
  } finally {
    reader.releaseLock();
  }

  res.write('data: [DONE]\\n\\n');
  res.end();
}

function convertGeminiParts(content: any) {
  if (typeof content === 'string') {
    return [{ text: content }];
  }

  if (!Array.isArray(content)) {
    return [{ text: String(content || '') }];
  }

  return content
    .map((part: any) => {
      if (part.type === 'text') {
        return {
          text: part.text || '',
        };
      }

      if (
        part.type === 'inline_data' &&
        part.inline_data
      ) {
        return {
          inline_data: {
            mime_type:
              part.inline_data.mime_type,
            data:
              part.inline_data.data,
          },
        };
      }

      return null;
    })
    .filter(Boolean);
}
