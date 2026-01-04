import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type BlogStatus = "Draft" | "Published";

export const BLOG_CATEGORIES = [
  "Data Quality",
  "Schema Drift",
  "Engineering Rigor",
  "Best Practices",
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number];

export type BlogRow = Tables<"blogs">;

export type BlogFormValues = {
  title: string;
  slug: string;
  category: BlogCategory;
  featuredImagePath: string | null;
  featuredImageThumbPath: string | null;
  audioPath: string | null;
  mediaPaths: string[];
  description: string;
  content: string;
  author: string;
  publishDate: string; // yyyy-mm-dd
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
  status: BlogStatus;
};

export const slugify = (input: string) =>
  input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

export const isValidSlug = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

export const stripHtmlToText = (html: string) => {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
};

export const countWords = (text: string) => {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).filter(Boolean).length;
};

export const calculateReadTimeMinutes = (html: string, wpm = 200) => {
  const words = countWords(stripHtmlToText(html));
  return Math.max(1, Math.ceil(words / wpm));
};

export const getPublicUrl = (bucket: string, path: string | null) => {
  if (!path) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
};

export const formatDateForUI = (iso: string) => {
  // iso is a timestamp string from Supabase
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export const getTodayYyyyMmDd = () => {
  const now = new Date();
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const dataUrlToBlob = async (dataUrl: string) => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

export const generateImageThumbnail = async (file: File, maxWidth = 640) => {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });

    const scale = Math.min(1, maxWidth / img.width);
    const width = Math.round(img.width * scale);
    const height = Math.round(img.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Failed to create canvas context");
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/webp", 0.85);
    const blob = await dataUrlToBlob(dataUrl);

    return new File([blob], `thumb_${file.name.replace(/\.[^.]+$/, "")}.webp`, {
      type: "image/webp",
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

export const uploadToSupabaseWithProgress = async (params: {
  bucket: string;
  path: string;
  file: File;
  onProgress?: (pct: number) => void;
}) => {
  const { bucket, path, file, onProgress } = params;

  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
  const apiKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  return await new Promise<{ path: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.setRequestHeader("apikey", apiKey);
    xhr.setRequestHeader("Authorization", `Bearer ${apiKey}`);
    xhr.setRequestHeader("x-upsert", "false");

    xhr.upload.onprogress = (e) => {
      if (!onProgress) return;
      if (!e.lengthComputable) return;
      const pct = Math.min(100, Math.max(0, Math.round((e.loaded / e.total) * 100)));
      onProgress(pct);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ path });
        return;
      }

      const raw = xhr.responseText || "";
      const parsedMessage = (() => {
        try {
          const json = JSON.parse(raw);
          return String((json?.message ?? json?.error ?? json?.hint ?? "") || "").trim() || null;
        } catch {
          return null;
        }
      })();

      const details = parsedMessage ?? raw.trim() ?? null;
      reject(new Error(details ? `Upload failed (${xhr.status}): ${details}` : `Upload failed (${xhr.status})`));
    };

    xhr.onerror = () => reject(new Error("Upload failed: network error"));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
};
