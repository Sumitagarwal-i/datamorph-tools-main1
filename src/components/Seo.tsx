import { useEffect } from "react";
import { buildAbsoluteUrl, SITE_NAME, SITE_ORIGIN } from "@/lib/site";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  imagePath?: string;
  noIndex?: boolean;
}

export function Seo({ title, description, path, imagePath = "/og_hero_2_transform.webp", noIndex }: SeoProps) {
  useEffect(() => {
    if (typeof document === "undefined") return;

    const url = buildAbsoluteUrl(path);
    const imageUrl = imagePath.startsWith("http") ? imagePath : `${SITE_ORIGIN}${imagePath}`;

    document.title = title;

    const applyLink = (rel: string, href: string) => {
      let link = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
      if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", rel);
        document.head.appendChild(link);
      }
      link.setAttribute("href", href);
    };

    const applyMeta = (attrName: "name" | "property", attrValue: string, content: string) => {
      const selector = `meta[${attrName}="${attrValue}"]`;
      let tag = document.head.querySelector<HTMLMetaElement>(selector);
      if (!tag) {
        tag = document.createElement("meta");
        tag.setAttribute(attrName, attrValue);
        document.head.appendChild(tag);
      }
      tag.setAttribute("content", content);
    };

    applyLink("canonical", url);
    applyMeta("name", "description", description);
    applyMeta("name", "robots", noIndex ? "noindex, nofollow" : "index, follow");

    const ogMeta: [string, string][] = [
      ["og:type", "website"],
      ["og:site_name", SITE_NAME],
      ["og:url", url],
      ["og:title", title],
      ["og:description", description],
      ["og:image", imageUrl],
    ];

    const twitterMeta: [string, string][] = [
      ["twitter:card", "summary_large_image"],
      ["twitter:url", url],
      ["twitter:title", title],
      ["twitter:description", description],
      ["twitter:image", imageUrl],
    ];

    ogMeta.forEach(([key, value]) => applyMeta("property", key, value));
    twitterMeta.forEach(([key, value]) => applyMeta("name", key, value));
  }, [title, description, path, imagePath, noIndex]);

  return null;
}
