import { useEffect } from "react";

const SITE_URL = "https://nexusai.farhanbalouch.com";

const DEFAULT_TITLE =
  "Nexus AI — Intelligent AI Assistant | Farhan Balouch";

const DEFAULT_DESCRIPTION =
  "Nexus AI is an intelligent AI assistant created by Farhan Balouch, designed for AI chat, productivity, documents, AI agents, and everyday work.";

type SeoProps = {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
};

function Seo({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = "/og-image.svg",
}: SeoProps) {
  useEffect(() => {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    const canonicalUrl =
      normalizedPath === "/"
        ? SITE_URL + "/"
        : `${SITE_URL}${normalizedPath}`;

    const imageUrl = image.startsWith("http")
      ? image
      : `${SITE_URL}${image.startsWith("/") ? image : `/${image}`}`;

    // Page title
    document.title = title;

    // Helper for meta tags
    const setMeta = (
      attribute: "name" | "property",
      key: string,
      content: string
    ) => {
      let element = document.head.querySelector(
        `meta[${attribute}="${key}"]`
      ) as HTMLMetaElement | null;

      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }

      element.setAttribute("content", content);
    };

    // Basic SEO
    setMeta("name", "description", description);
    setMeta("name", "author", "Farhan Balouch");
    setMeta(
      "name",
      "robots",
      "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"
    );

    // Canonical
    let canonical = document.head.querySelector(
      'link[rel="canonical"]'
    ) as HTMLLinkElement | null;

    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }

    canonical.setAttribute("href", canonicalUrl);

    // Open Graph
    setMeta("property", "og:type", "website");
    setMeta("property", "og:url", canonicalUrl);
    setMeta("property", "og:title", title);
    setMeta("property", "og:description", description);
    setMeta("property", "og:site_name", "Nexus AI");
    setMeta("property", "og:image", imageUrl);
    setMeta(
      "property",
      "og:image:alt",
      "Nexus AI — Intelligent AI Assistant"
    );

    // Twitter / X
    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:url", canonicalUrl);
    setMeta("name", "twitter:title", title);
    setMeta("name", "twitter:description", description);
    setMeta("name", "twitter:image", imageUrl);
    setMeta(
      "name",
      "twitter:image:alt",
      "Nexus AI — Intelligent AI Assistant"
    );

    // Restore the default title if this component is removed
    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [title, description, path, image]);

  return null;
}

export { Seo };
