// src/lib/models.ts
import type { Provider } from './database.types';

export interface ModelOption {
  id: string; // fully-qualified id, e.g. "groq/openai/gpt-oss-120b"
  label: string; // display name
  provider: Provider;
  description: string;
  badge?: string; // small tag like "Fast" / "Vision"
  contextWindow: string; // human-readable
}

/**
 * Catalog of AI models available in Nexus AI. Grouped by provider.
 * The edge function maps these to the correct upstream model id.
 *
 * Keep this list current — providers deprecate model ids over time
 * (e.g. Groq retired llama-3.3-70b-versatile and llama-3.1-8b-instant on
 * Aug 16, 2026; Google retires older Gemini generations on a rolling basis;
 * OpenRouter model slugs change as upstream providers rotate versions).
 * If a model starts returning "model not found" / "no endpoints found",
 * check the provider's current model list and update the id here.
 */
export const MODELS: ModelOption[] = [
  // Groq — fast inference
  {
    id: 'groq/openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: 'groq',
    description: 'OpenAI open-weight model with strong reasoning.',
    badge: 'Fast',
    contextWindow: '128K',
  },
  {
    id: 'groq/openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    provider: 'groq',
    description: 'Snappy lightweight model for quick replies and drafts.',
    badge: 'Fastest',
    contextWindow: '128K',
  },
  {
    id: 'groq/qwen/qwen3.6-27b',
    label: 'Qwen3.6 27B',
    provider: 'groq',
    description: 'Alibaba\'s versatile model — great general-purpose reasoning.',
    contextWindow: '128K',
  },
  {
    id: 'groq/moonshotai/kimi-k2-instruct-0905',
    label: 'Kimi K2 Instruct',
    provider: 'groq',
    description: 'Agentic model tuned for tool use and multi-step tasks.',
    badge: 'New',
    contextWindow: '128K',
  },

  // Gemini
  {
    id: 'gemini/gemini-3.6-flash',
    label: 'Gemini 3.6 Flash',
    provider: 'gemini',
    description: 'Google\'s latest fast multimodal model with a huge context window.',
    badge: 'Fast',
    contextWindow: '1M',
  },
  {
    id: 'gemini/gemini-3.5-flash-lite',
    label: 'Gemini 3.5 Flash Lite',
    provider: 'gemini',
    description: 'Low-latency, cost-efficient Gemini for high-volume tasks.',
    badge: 'Multimodal',
    contextWindow: '1M',
  },
  {
    id: 'gemini/gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    provider: 'gemini',
    description: 'Google\'s most capable model for complex reasoning.',
    badge: 'Pro',
    contextWindow: '1M',
  },

  // OpenRouter (optional aggregator)
  {
    id: 'openrouter/anthropic/claude-sonnet-4.6',
    label: 'Claude Sonnet 4.6',
    provider: 'openrouter',
    description: 'Anthropic\'s flagship via OpenRouter — excellent for writing & code.',
    badge: 'Premium',
    contextWindow: '1M',
  },
  {
    id: 'openrouter/openai/gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    provider: 'openrouter',
    description: 'OpenAI\'s efficient model via OpenRouter.',
    contextWindow: '128K',
  },
  {
    id: 'openrouter/meta-llama/llama-3.3-70b-instruct',
    label: 'Llama 3.3 70B',
    provider: 'openrouter',
    description: 'Meta\'s versatile open model for general-purpose tasks.',
    badge: 'Open',
    contextWindow: '128K',
  },
];

export const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: 'groq', label: 'Groq', description: 'Ultra-fast inference' },
  { id: 'gemini', label: 'Gemini', description: 'Google multimodal' },
  { id: 'openrouter', label: 'OpenRouter', description: 'Multi-model access' },
];

export function getModel(id: string, list: ModelOption[] = MODELS): ModelOption | undefined {
  return list.find((m) => m.id === id);
}

export function modelsByProvider(provider: Provider, list: ModelOption[] = MODELS): ModelOption[] {
  return list.filter((m) => m.provider === provider);
}
export const DEFAULT_MODEL_ID = 'groq/openai/gpt-oss-120b';
