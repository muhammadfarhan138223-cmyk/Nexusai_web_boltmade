import { MODELS, type ModelOption } from './models';

const CACHE_KEY = 'nexus-model-catalog';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours

interface CatalogResponse {
  groq: ModelOption[];
  gemini: ModelOption[];
  openrouter: ModelOption[];
}

function readCache(): ModelOption[] | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; models: ModelOption[] };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.models.length ? parsed.models : null;
  } catch {
    return null;
  }
}

function writeCache(models: ModelOption[]) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), models }));
  } catch {
    /* storage full/unavailable — non-fatal */
  }
}

/**
 * Returns the live-verified model list — only models that are actually
 * present on each connected provider's account right now — falling back to
 * the static catalog in '@/lib/models' if the check hasn't completed yet or
 * fails for any reason. Results are cached in localStorage for a few hours.
 */
export async function getVerifiedModels(): Promise<ModelOption[]> {
  const cached = readCache();
  if (cached) return cached;

  try {
    const res = await fetch('/api/models');
    if (!res.ok) return MODELS;
    const data = (await res.json()) as CatalogResponse;
    const combined = [...(data.groq ?? []), ...(data.gemini ?? []), ...(data.openrouter ?? [])];
    if (combined.length === 0) return MODELS;
    writeCache(combined);
    return combined;
  } catch {
    return MODELS;
  }
}
