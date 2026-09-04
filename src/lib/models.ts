import type { Provider } from './database.types';

export interface ModelOption {
  id: string; // fully-qualified id, e.g. "groq/llama-3.3-70b-versatile"
  label: string; // display name
  provider: Provider;
  description: string;
  badge?: string; // small tag like "Fast" / "Vision"
  contextWindow: string; // human-readable
}

/**
 * Catalog of AI models available in Nexus AI. Grouped by provider.
 * The edge function maps these to the correct upstream model id.
 */
export const MODELS: ModelOption[] = [
  // Groq — fast inference
  {
    id: 'groq/llama-3.3-70b-versatile',
    label: 'Llama 3.3 70B',
    provider: 'groq',
    description: 'Meta\'s versatile flagship — great general-purpose reasoning.',
    badge: 'Fast',
    contextWindow: '128K',
  },
  {
    id: 'groq/llama-3.1-8b-instant',
    label: 'Llama 3.1 8B Instant',
    provider: 'groq',
    description: 'Snappy lightweight model for quick replies and drafts.',
    badge: 'Fastest',
    contextWindow: '128K',
  },
  {
    id: 'groq/openai/gpt-oss-120b',
    label: 'GPT-OSS 120B',
    provider: 'groq',
    description: 'OpenAI open-weight model with strong reasoning.',
    badge: 'New',
    contextWindow: '128K',
  },
  {
    id: 'groq/moonshotai/kimi-k2-instruct',
    label: 'Kimi K2 Instruct',
    provider: 'groq',
    description: 'Agentic model tuned for tool use and multi-step tasks.',
    contextWindow: '128K',
  },

  // Gemini
  {
    id: 'gemini/gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    provider: 'gemini',
    description: 'Google\'s fast multimodal model with a huge context window.',
    badge: 'Fast',
    contextWindow: '1M',
  },
  {
    id: 'gemini/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    provider: 'gemini',
    description: 'Latest balanced Gemini with strong reasoning at low latency. Supports images, audio, and video.',
    badge: 'Multimodal',
    contextWindow: '1M',
  },
  {
    id: 'gemini/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    provider: 'gemini',
    description: 'Google\'s most capable model for complex reasoning.',
    badge: 'Pro',
    contextWindow: '1M',
  },

  // OpenRouter (optional aggregator)
  {
    id: 'openrouter/anthropic/claude-3.5-sonnet',
    label: 'Claude 3.5 Sonnet',
    provider: 'openrouter',
    description: 'Anthropic\'s flagship via OpenRouter — excellent for writing & code.',
    badge: 'Premium',
    contextWindow: '200K',
  },
  {
    id: 'openrouter/openai/gpt-4o-mini',
    label: 'GPT-4o mini',
    provider: 'openrouter',
    description: 'OpenAI\'s efficient model via OpenRouter.',
    contextWindow: '128K',
  },
  {
    id: 'openrouter/meta-llama/llama-3.1-405b-instruct',
    label: 'Llama 3.1 405B',
    provider: 'openrouter',
    description: 'Massive Meta model for the hardest tasks.',
    badge: 'Heavy',
    contextWindow: '128K',
  },
];

export const PROVIDERS: { id: Provider; label: string; description: string }[] = [
  { id: 'groq', label: 'Groq', description: 'Ultra-fast inference' },
  { id: 'gemini', label: 'Gemini', description: 'Google multimodal' },
  { id: 'openrouter', label: 'OpenRouter', description: 'Multi-model access' },
];

export function getModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsByProvider(provider: Provider): ModelOption[] {
  return MODELS.filter((m) => m.provider === provider);
}

export const DEFAULT_MODEL_ID = 'groq/llama-3.3-70b-versatile';
