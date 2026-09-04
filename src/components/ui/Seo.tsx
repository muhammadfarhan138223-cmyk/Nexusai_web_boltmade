import { useEffect } from 'react';

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
}

const DEFAULT_TITLE = 'Nexus AI — Your Intelligent Assistant for Work & Life';
const DEFAULT_DESC =
  'A premium AI assistant platform with streaming chat, multi-model support, document tools, and a growing ecosystem of AI agents.';

/**
 * Lightweight SEO manager: updates document.title + meta tags on route change.
 * Avoids a router dependency; App calls this per-view.
 */
export function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    const fullTitle = title ? `${title} — Nexus AI` : DEFAULT_TITLE;
    document.title = fullTitle;

    setMeta('name', 'description', description ?? DEFAULT_DESC);
    setMeta('property', 'og:title', fullTitle);
    setMeta('property', 'og:description', description ?? DEFAULT_DESC);
    setMeta('name', 'twitter:title', fullTitle);
    setMeta('name', 'twitter:description', description ?? DEFAULT_DESC);
    if (path) {
      setMeta('property', 'og:url', `https://nexusai.app${path}`);
      setMeta('name', 'twitter:url', `https://nexusai.app${path}`);
    }
  }, [title, description, path]);

  return null;
}

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}
