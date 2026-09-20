// api/models.ts — copy this whole file as a NEW file at api/models.ts
// Providers deprecate/rename model ids frequently (we've been burned by this
// repeatedly). Instead of trusting a hardcoded list, this endpoint checks a
// curated list of *candidate* models against each provider's live model
// list and returns only the ones that actually exist on the account right
// now. The frontend (src/lib/modelCatalog.ts) calls this once and caches
// the result for a few hours.

interface Candidate {
  id: string;
  label: string;
  description: string;
  badge?: string;
  contextWindow: string;
}

const GROQ_CANDIDATES: Candidate[] = [
  { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', description: 'OpenAI open-weight model with strong reasoning.', badge: 'Fast', contextWindow: '128K' },
  { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', description: 'Snappy lightweight model for quick replies and drafts.', badge: 'Fastest', contextWindow: '128K' },
  { id: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B', description: "Alibaba's versatile model for general-purpose reasoning.", contextWindow: '128K' },
  { id: 'qwen/qwen3.8-27b', label: 'Qwen3.8 27B', description: "Alibaba's latest reasoning model.", badge: 'New', contextWindow: '128K' },
  { id: 'moonshotai/kimi-k2-instruct-0905', label: 'Kimi K2 Instruct', description: 'Agentic model tuned for tool use and multi-step tasks.', contextWindow: '256K' },
  { id: 'moonshotai/kimi-k2-instruct', label: 'Kimi K2 Instruct', description: 'Agentic model tuned for tool use and multi-step tasks.', contextWindow: '128K' },
  { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout', description: 'Multimodal Meta model — text and image input.', badge: 'Vision', contextWindow: '128K' },
  { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', description: "Meta's versatile flagship model.", contextWindow: '128K' },
  { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', description: 'Lightweight model for quick replies.', badge: 'Fastest', contextWindow: '128K' },
];

const GEMINI_CANDIDATES: Candidate[] = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', description: "Google's latest fast multimodal model with a huge context window.", badge: 'Fast', contextWindow: '1M' },
  { id: 'gemini-3.5-flash', label: 'Gemini 3.5 Flash', description: "Google's frontier fast model.", badge: 'Fast', contextWindow: '1M' },
  { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite', description: 'Low-latency, cost-efficient Gemini for high-volume tasks.', badge: 'Multimodal', contextWindow: '1M' },
  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', description: 'Cost-efficient workhorse Gemini model.', contextWindow: '1M' },
  { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', description: 'Fast multimodal Gemini model.', contextWindow: '1M' },
];

// Free OpenRouter models are discovered live (see fetchOpenRouterModels below)
// — every ":free" / $0-priced model shows up automatically, no list to
// maintain here. This is only the curated *paid* fallback list (shown only
// if the account actually has a working route to each, via the live check).
const OPENROUTER_PAID_CANDIDATES: Candidate[] = [
  { id: 'anthropic/claude-sonnet-4.6', label: 'Claude Sonnet 4.6', description: "Anthropic's flagship via OpenRouter — excellent for writing & code.", badge: 'Premium', contextWindow: '1M' },
  { id: 'anthropic/claude-haiku-4.5', label: 'Claude Haiku 4.5', description: 'Fast, efficient Claude model.', badge: 'Premium', contextWindow: '200K' },
  { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini', description: "OpenAI's efficient model via OpenRouter.", badge: 'Premium', contextWindow: '128K' },
];
export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const [groq, gemini, openrouter] = await Promise.all([
    fetchGroqModels(),
    fetchGeminiModels(),
    fetchOpenRouterModels(),
  ]);

  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  return res.status(200).json({ groq, gemini, openrouter });
}

async function fetchGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const liveIds = new Set((data?.data ?? []).map((m: any) => m.id));
    return GROQ_CANDIDATES.filter((c) => liveIds.has(c.id)).map((c) => ({
      ...c,
      id: `groq/${c.id}`,
      provider: 'groq',
    }));
  } catch {
    return [];
  }
}

async function fetchGeminiModels() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
    );
    if (!r.ok) return [];
    const data = await r.json();
    const liveIds = new Set(
      (data?.models ?? []).map((m: any) => String(m.name || '').replace(/^models\//, '')),
    );
    return GEMINI_CANDIDATES.filter((c) => liveIds.has(c.id)).map((c) => ({
      ...c,
      id: `gemini/${c.id}`,
      provider: 'gemini',
    }));
  } catch {
    return [];
  }
}

function formatContextWindow(tokens: number): string {
  if (!tokens || tokens <= 0) return '—';
  if (tokens >= 1_000_000) return `${Math.round(tokens / 1_000_000)}M`;
  if (tokens >= 1_000) return `${Math.round(tokens / 1000)}K`;
  return String(tokens);
}

async function fetchOpenRouterModels() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const allModels: any[] = data?.data ?? [];

    // Pull in EVERY model OpenRouter currently serves for free — a model is
    // free if its own price table shows $0 per token, or its id ends in
    // ":free" (OpenRouter's usual free-route naming convention). No
    // hardcoded candidate list needed: whatever they add/remove shows up
    // automatically next time this runs.
    const freeModels = allModels.filter((m) => {
      const promptPrice = parseFloat(m?.pricing?.prompt ?? '1');
      const completionPrice = parseFloat(m?.pricing?.completion ?? '1');
      const isFree = (promptPrice === 0 && completionPrice === 0) || String(m.id).endsWith(':free');
      return isFree;
    });

    const free = freeModels.map((m) => ({
      id: `openrouter/${m.id}`,
      label: String(m.name || m.id).replace(/\s*\(free\)\s*$/i, '').trim(),
      description: m.description
        ? String(m.description).slice(0, 140)
        : 'Free model available via OpenRouter.',
      badge: 'Free',
      contextWindow: formatContextWindow(m.context_length),
      provider: 'openrouter',
    }));

    const liveIds = new Set(allModels.map((m: any) => m.id));
    const paid = OPENROUTER_PAID_CANDIDATES.filter((c) => liveIds.has(c.id)).map((c) => ({
      ...c,
      id: `openrouter/${c.id}`,
      provider: 'openrouter',
    }));

    return [...free, ...paid];
  } catch {
    return [];
  }
}
