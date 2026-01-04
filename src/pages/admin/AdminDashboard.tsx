import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  BLOG_CATEGORIES,
  calculateReadTimeMinutes,
  countWords,
  generateImageThumbnail,
  getPublicUrl,
  getTodayYyyyMmDd,
  isValidSlug,
  slugify,
  stripHtmlToText,
  uploadToSupabaseWithProgress,
} from "@/lib/blog";
import { toast } from "sonner";

import RichTextEditor from "@/components/RichTextEditor";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Play } from "lucide-react";

type BlogRow = Tables<"blogs">;

type BlogStatus = "Draft" | "Published";

type FormState = {
  id: string | null;
  title: string;
  slug: string;
  category: string;
  description: string;
  content: string;
  author: string;
  publish_date: string;
  status: BlogStatus;
  metaTitle: string;
  metaDescription: string;
  metaKeywords: string;
};

const emptyForm = (): FormState => ({
  id: null,
  title: "",
  slug: "",
  category: BLOG_CATEGORIES[0],
  description: "",
  content: "",
  author: "",
  publish_date: getTodayYyyyMmDd(),
  status: "Draft",
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
});

const toSeoMeta = (form: FormState) => {
  const meta: Record<string, string> = {};
  if (form.metaTitle.trim()) meta.title = form.metaTitle.trim();
  if (form.metaDescription.trim()) meta.description = form.metaDescription.trim();
  if (form.metaKeywords.trim()) meta.keywords = form.metaKeywords.trim();
  return Object.keys(meta).length ? meta : null;
};

const fromRowToForm = (row: BlogRow): FormState => {
  const meta = (row.seo_meta as any) ?? {};
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category,
    description: row.description,
    content: row.content,
    author: row.author,
    publish_date: row.publish_date,
    status: (row.status as BlogStatus) === "Published" ? "Published" : "Draft",
    metaTitle: String(meta.title ?? ""),
    metaDescription: String(meta.description ?? ""),
    metaKeywords: String(meta.keywords ?? ""),
  };
};

const buildStoragePath = (prefix: string, slug: string, file: File) => {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeExt = String(ext || "bin").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return `${prefix}/${slug}/${stamp}.${safeExt || "bin"}`;
};

const AdminDashboard = () => {
  const [rows, setRows] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"All" | BlogStatus>("All");
  const [sort, setSort] = useState<"updated_desc" | "publish_desc" | "title_asc">("updated_desc");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [form, setForm] = useState<FormState>(() => emptyForm());
  const [featuredImageFile, setFeaturedImageFile] = useState<File | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const [existingFeaturedPath, setExistingFeaturedPath] = useState<string | null>(null);
  const [existingFeaturedThumbPath, setExistingFeaturedThumbPath] = useState<string | null>(null);
  const [existingMediaPaths, setExistingMediaPaths] = useState<string[]>([]);
  const [existingAudioPath, setExistingAudioPath] = useState<string | null>(null);

  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);

  const lastLoadedFormRef = useRef<string>(JSON.stringify(form));

  const computedReadTime = useMemo(() => {
    try {
      return calculateReadTimeMinutes(form.content);
    } catch {
      return 1;
    }
  }, [form.content]);

  const computedWordCount = useMemo(() => {
    try {
      return countWords(stripHtmlToText(form.content));
    } catch {
      return 0;
    }
  }, [form.content]);

  const filteredSorted = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = rows.filter((r) => {
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.category ?? "").toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "title_asc") return a.title.localeCompare(b.title);
      if (sort === "publish_desc") return String(b.publish_date).localeCompare(String(a.publish_date));
      return String(b.updated_at).localeCompare(String(a.updated_at));
    });

    return sorted;
  }, [query, rows, sort, statusFilter]);

  const pageCount = useMemo(
    () => Math.max(1, Math.ceil(filteredSorted.length / pageSize)),
    [filteredSorted.length]
  );

  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredSorted.slice(start, start + pageSize);
  }, [filteredSorted, page]);

  useEffect(() => {
    setPage(1);
  }, [query, statusFilter, sort]);

  const loadRows = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setRows((data ?? []) as BlogRow[]);
    } catch (e: any) {
      toast.error(e?.message || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRows();
  }, []);

  const resetForm = () => {
    setForm(emptyForm());
    setFeaturedImageFile(null);
    setMediaFiles([]);
    setAudioFile(null);
    setExistingFeaturedPath(null);
    setExistingFeaturedThumbPath(null);
    setExistingMediaPaths([]);
    setExistingAudioPath(null);
    setUploadPct(null);
    setUploadLabel(null);
    lastLoadedFormRef.current = JSON.stringify(emptyForm());
  };

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const ensureSlug = (title: string) => {
    const current = form.slug.trim();
    if (current) return;
    setFormField("slug", slugify(title));
  };

  const validate = () => {
    if (!form.title.trim()) return "Title is required";
    if (!form.slug.trim()) return "Slug is required";
    if (!isValidSlug(form.slug.trim())) return "Slug must be lowercase letters, numbers, and hyphens";
    if (!form.category.trim()) return "Category is required";
    if (!form.description.trim()) return "Description is required";
    if (!form.content.trim()) return "Content is required";
    if (!form.author.trim()) return "Author is required";
    if (!form.publish_date.trim()) return "Publish date is required";
    return null;
  };

  const upsertStorageAssets = async (slug: string) => {
    let featured_image_path: string | null = null;
    let featured_image_thumb_path: string | null = null;
    let media_paths: string[] = [];
    let audio_path: string | null = null;

    if (featuredImageFile) {
      setUploadLabel("Uploading featured image…");
      setUploadPct(0);
      const originalPath = buildStoragePath("featured", slug, featuredImageFile);

      await uploadToSupabaseWithProgress({
        bucket: "blog-images",
        path: originalPath,
        file: featuredImageFile,
        onProgress: setUploadPct,
      });

      featured_image_path = originalPath;

      try {
        setUploadLabel("Generating thumbnail…");
        const thumbFile = await generateImageThumbnail(featuredImageFile);
        setUploadLabel("Uploading thumbnail…");
        setUploadPct(0);
        const thumbPath = buildStoragePath("thumbs", slug, thumbFile);

        await uploadToSupabaseWithProgress({
          bucket: "blog-images",
          path: thumbPath,
          file: thumbFile,
          onProgress: setUploadPct,
        });

        featured_image_thumb_path = thumbPath;
      } catch {
        // Thumbnail is optional
      }
    }

    if (mediaFiles.length) {
      const paths: string[] = [];
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        setUploadLabel(`Uploading media ${i + 1}/${mediaFiles.length}…`);
        setUploadPct(0);
        const path = buildStoragePath("media", slug, file);
        await uploadToSupabaseWithProgress({
          bucket: "blog-media",
          path,
          file,
          onProgress: setUploadPct,
        });
        paths.push(path);
      }
      media_paths = paths;
    }

    if (audioFile) {
      setUploadLabel("Uploading audio…");
      setUploadPct(0);
      const path = buildStoragePath("audio", slug, audioFile);
      await uploadToSupabaseWithProgress({
        bucket: "blog-media",
        path,
        file: audioFile,
        onProgress: setUploadPct,
      });
      audio_path = path;
    }

    setUploadLabel(null);
    setUploadPct(null);

    return { featured_image_path, featured_image_thumb_path, media_paths, audio_path };
  };

  const removeAudioNow = async () => {
    if (!form.id) return;
    if (!existingAudioPath) return;
    try {
      await supabase.storage.from("blog-media").remove([existingAudioPath]);
      const { error } = await supabase
        .from("blogs")
        .update({ audio_path: null, updated_at: new Date().toISOString() })
        .eq("id", form.id);
      if (error) throw error;
      setExistingAudioPath(null);
      toast.success("Audio removed");
      await loadRows();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove audio");
    }
  };

  const removeFeaturedNow = async () => {
    if (!form.id) return;
    const paths = [existingFeaturedPath, existingFeaturedThumbPath].filter(Boolean) as string[];
    try {
      if (paths.length) {
        await supabase.storage.from("blog-images").remove(paths);
      }
      const { error } = await supabase
        .from("blogs")
        .update({ featured_image_path: null, featured_image_thumb_path: null, updated_at: new Date().toISOString() })
        .eq("id", form.id);
      if (error) throw error;
      setExistingFeaturedPath(null);
      setExistingFeaturedThumbPath(null);
      toast.success("Featured image removed");
      await loadRows();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove featured image");
    }
  };

  const removeExistingMediaNow = async (path: string) => {
    if (!form.id) return;
    try {
      await supabase.storage.from("blog-media").remove([path]);
      const next = existingMediaPaths.filter((p) => p !== path);
      const { error } = await supabase
        .from("blogs")
        .update({ media_paths: next.length ? next : null, updated_at: new Date().toISOString() })
        .eq("id", form.id);
      if (error) throw error;
      setExistingMediaPaths(next);
      toast.success("Media removed");
      await loadRows();
    } catch (e: any) {
      toast.error(e?.message || "Failed to remove media");
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }

    setSaving(true);
    try {
      const slug = form.slug.trim();

      // slug uniqueness check (for new posts)
      if (!form.id) {
        const { data: existing, error: existingError } = await supabase
          .from("blogs")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (existingError) throw existingError;
        if (existing?.id) {
          toast.error("Slug already exists. Please choose a different slug.");
          return;
        }
      }

      const assets = await upsertStorageAssets(slug);

      const nowIso = new Date().toISOString();
      const read_time = calculateReadTimeMinutes(form.content);
      const seo_meta = toSeoMeta(form);

      if (!form.id) {
        const { error } = await supabase.from("blogs").insert({
          title: form.title.trim(),
          slug,
          category: form.category,
          featured_image_path: assets.featured_image_path,
          featured_image_thumb_path: assets.featured_image_thumb_path,
          audio_path: assets.audio_path,
          media_paths: assets.media_paths.length ? assets.media_paths : null,
          description: form.description.trim(),
          content: form.content,
          author: form.author.trim(),
          publish_date: form.publish_date,
          status: form.status,
          read_time,
          seo_meta,
          created_at: nowIso,
          updated_at: nowIso,
        });
        if (error) throw error;
        toast.success("Post created");
      } else {
        // For edits: preserve existing stored assets unless new ones were selected
        const current = rows.find((r) => r.id === form.id);
        const featured_image_path = assets.featured_image_path ?? current?.featured_image_path ?? null;
        const featured_image_thumb_path =
          assets.featured_image_thumb_path ?? current?.featured_image_thumb_path ?? null;
        const audio_path = assets.audio_path ?? current?.audio_path ?? null;

        const mergedMedia = (() => {
          const existing = (current?.media_paths ?? []) as string[];
          const added = assets.media_paths;
          const next = [...existing, ...added].filter(Boolean);
          return next.length ? next : null;
        })();

        const { error } = await supabase
          .from("blogs")
          .update({
            title: form.title.trim(),
            slug,
            category: form.category,
            featured_image_path,
            featured_image_thumb_path,
            audio_path,
            media_paths: mergedMedia,
            description: form.description.trim(),
            content: form.content,
            author: form.author.trim(),
            publish_date: form.publish_date,
            status: form.status,
            read_time,
            seo_meta,
            updated_at: nowIso,
          })
          .eq("id", form.id);
        if (error) throw error;

        // If we uploaded a new featured image, delete the previous one(s) best-effort.
        if (assets.featured_image_path && current?.featured_image_path) {
          const old = [current.featured_image_path, current.featured_image_thumb_path]
            .filter(Boolean)
            .filter((p) => p !== assets.featured_image_path && p !== assets.featured_image_thumb_path) as string[];
          if (old.length) {
            await supabase.storage.from("blog-images").remove(old);
          }
        }

        // If we uploaded a new audio file, delete the previous one best-effort.
        if (assets.audio_path && current?.audio_path && current.audio_path !== assets.audio_path) {
          await supabase.storage.from("blog-media").remove([current.audio_path]);
        }

        toast.success("Post updated");
      }

      await loadRows();
      resetForm();
    } catch (e: any) {
      const msg = String(e?.message || "").toLowerCase();
      if (msg.includes("exceeded maximum allowed size") || msg.includes("maximum allowed size")) {
        toast.error(
          "Upload failed: file exceeds the Storage bucket max size. Increase the 'blog-media' bucket max file size in Supabase Storage settings, or upload a smaller audio file."
        );
      } else {
        toast.error(e?.message || "Failed to save post");
      }
    } finally {
      setSaving(false);
      setUploadLabel(null);
      setUploadPct(null);
    }
  };

  const handleEdit = (row: BlogRow) => {
    setForm(fromRowToForm(row));
    setFeaturedImageFile(null);
    setMediaFiles([]);
    setAudioFile(null);
    setExistingFeaturedPath(row.featured_image_path ?? null);
    setExistingFeaturedThumbPath(row.featured_image_thumb_path ?? null);
    setExistingMediaPaths(((row.media_paths ?? []) as string[]).filter(Boolean));
    setExistingAudioPath(row.audio_path ?? null);
    setUploadLabel(null);
    setUploadPct(null);
    lastLoadedFormRef.current = JSON.stringify(fromRowToForm(row));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const removeStorageFilesBestEffort = async (row: BlogRow) => {
    const imagePaths = [row.featured_image_path, row.featured_image_thumb_path].filter(Boolean) as string[];
    const mediaPaths = ((row.media_paths ?? []) as string[]).filter(Boolean);
    const audioPath = row.audio_path;

    if (imagePaths.length) {
      await supabase.storage.from("blog-images").remove(imagePaths);
    }
    if (mediaPaths.length) {
      await supabase.storage.from("blog-media").remove(mediaPaths);
    }
    if (audioPath) {
      await supabase.storage.from("blog-media").remove([audioPath]);
    }
  };

  const handleDelete = async (row: BlogRow) => {
    const ok = window.confirm(`Delete “${row.title}”? This cannot be undone.`);
    if (!ok) return;

    try {
      await removeStorageFilesBestEffort(row);
      const { error } = await supabase.from("blogs").delete().eq("id", row.id);
      if (error) throw error;
      toast.success("Post deleted");
      await loadRows();

      if (form.id === row.id) resetForm();
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete post");
    }
  };

  // Basic autosave for Drafts (every 30s if changed)
  useEffect(() => {
    const interval = window.setInterval(async () => {
      if (!form.id) return;
      if (form.status !== "Draft") return;

      const currentJson = JSON.stringify(form);
      if (currentJson === lastLoadedFormRef.current) return;

      try {
        const nowIso = new Date().toISOString();
        const read_time = calculateReadTimeMinutes(form.content);
        const seo_meta = toSeoMeta(form);

        const { error } = await supabase
          .from("blogs")
          .update({
            title: form.title.trim(),
            slug: form.slug.trim(),
            category: form.category,
            description: form.description.trim(),
            content: form.content,
            author: form.author.trim(),
            publish_date: form.publish_date,
            status: form.status,
            read_time,
            seo_meta,
            updated_at: nowIso,
          })
          .eq("id", form.id);

        if (error) throw error;
        lastLoadedFormRef.current = currentJson;
        toast.message("Draft autosaved");
        await loadRows();
      } catch {
        // ignore autosave errors to avoid spam
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [form, rows]);

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>{form.id ? "Edit Blog Post" : "Add New Blog Post"}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={form.title}
                onChange={(e) => {
                  const next = e.target.value;
                  setFormField("title", next);
                  ensureSlug(next);
                }}
                placeholder="A precise title…"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setFormField("slug", slugify(e.target.value))}
                placeholder="my-post-title"
              />
              <div className="text-xs text-muted-foreground">
                {form.slug.trim() && !isValidSlug(form.slug.trim())
                  ? "Slug is invalid"
                  : "Lowercase, numbers, hyphens"}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => setFormField("category", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {BLOG_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setFormField("status", v as BlogStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input
                id="author"
                value={form.author}
                onChange={(e) => setFormField("author", e.target.value)}
                placeholder="Name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publish_date">Publish date</Label>
              <Input
                id="publish_date"
                type="date"
                value={form.publish_date}
                onChange={(e) => setFormField("publish_date", e.target.value)}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setFormField("description", e.target.value)}
                placeholder="Short summary used on the blog index and previews…"
                className="min-h-[90px]"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="content">Content</Label>
                <div className="text-xs text-muted-foreground">
                  {computedWordCount} words • {computedReadTime} min read
                </div>
              </div>
              <div id="content">
                <RichTextEditor value={form.content} slug={form.slug} onChange={(html) => setFormField("content", html)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Featured image</Label>
              <Input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setFeaturedImageFile(file);
                }}
              />
              <div className="text-xs text-muted-foreground">
                {featuredImageFile ? featuredImageFile.name : existingFeaturedPath ? "Existing image set" : "Optional"}
              </div>
              {form.id && existingFeaturedPath && !featuredImageFile && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = getPublicUrl("blog-images", existingFeaturedPath);
                      if (!url) return;
                      window.open(url, "_blank");
                    }}
                  >
                    View
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => void removeFeaturedNow()}>
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Media uploads</Label>
              <Input
                type="file"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  setMediaFiles(files);
                }}
              />
              <div className="text-xs text-muted-foreground">
                {mediaFiles.length
                  ? `${mediaFiles.length} new file(s) selected`
                  : existingMediaPaths.length
                    ? `${existingMediaPaths.length} existing file(s)`
                    : "Optional"}
              </div>

              {mediaFiles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.map((f) => (
                    <button
                      key={f.name + f.size}
                      type="button"
                      onClick={() => setMediaFiles((prev) => prev.filter((x) => x !== f))}
                      className="inline-flex items-center rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                      title="Remove"
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              )}

              {form.id && existingMediaPaths.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {existingMediaPaths.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void removeExistingMediaNow(p)}
                      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-3 py-1 text-xs text-muted-foreground hover:text-foreground"
                      title="Remove from post"
                    >
                      {p.split("/").slice(-1)[0]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Full blog audio</Label>
              <Input
                type="file"
                accept="audio/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setAudioFile(file);
                }}
              />
              <div className="text-xs text-muted-foreground">
                {audioFile ? audioFile.name : existingAudioPath ? "Existing audio set" : "Optional"}
              </div>

              {form.id && existingAudioPath && !audioFile && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const url = getPublicUrl("blog-media", existingAudioPath);
                      if (!url) return;
                      window.open(url, "_blank");
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Play
                  </Button>
                  <Button type="button" variant="destructive" size="sm" onClick={() => void removeAudioNow()}>
                    Remove
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="metaTitle">SEO title</Label>
                  <Input
                    id="metaTitle"
                    value={form.metaTitle}
                    onChange={(e) => setFormField("metaTitle", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="metaDescription">SEO description</Label>
                  <Input
                    id="metaDescription"
                    value={form.metaDescription}
                    onChange={(e) => setFormField("metaDescription", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-2">
                <Label htmlFor="metaKeywords">SEO keywords</Label>
                <Input
                  id="metaKeywords"
                  value={form.metaKeywords}
                  onChange={(e) => setFormField("metaKeywords", e.target.value)}
                  placeholder="Optional (comma-separated)"
                />
              </div>
            </div>

            {uploadLabel && (
              <div className="md:col-span-2">
                <div className="text-sm text-muted-foreground mb-2">{uploadLabel}</div>
                <Progress value={uploadPct ?? 0} />
              </div>
            )}

            <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">
                {form.id ? "Autosaves drafts every 30s" : "Create the post, then edits can autosave"}
              </div>

              <div className="flex items-center gap-2">
                {form.id && (
                  <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                    Cancel edit
                  </Button>
                )}
                <Button type="button" onClick={handleSave} disabled={saving}>
                  {saving ? "Saving…" : form.id ? "Save changes" : "Create post"}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <CardTitle>Manage Posts</CardTitle>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search title, slug, category…"
                className="sm:w-[260px]"
              />

              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                <SelectTrigger className="sm:w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Published">Published</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sort} onValueChange={(v) => setSort(v as any)}>
                <SelectTrigger className="sm:w-[190px]">
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="updated_desc">Updated (newest)</SelectItem>
                  <SelectItem value="publish_desc">Publish date (newest)</SelectItem>
                  <SelectItem value="title_asc">Title (A–Z)</SelectItem>
                </SelectContent>
              </Select>

              <Button type="button" variant="outline" onClick={loadRows} disabled={loading}>
                {loading ? "Refreshing…" : "Refresh"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Publish</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      {loading ? "Loading…" : "No posts found"}
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{r.title}</div>
                        <div className="text-xs text-muted-foreground">/{r.slug}</div>
                      </TableCell>
                      <TableCell>{r.status}</TableCell>
                      <TableCell>{r.category}</TableCell>
                      <TableCell>{r.publish_date}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={() => handleEdit(r)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              const url = r.status === "Published" ? `/blog/${r.slug}` : `/blog/${r.slug}?preview=1`;
                              window.open(url, "_blank");
                            }}
                          >
                            View
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => void handleDelete(r)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Showing {pageRows.length} of {filteredSorted.length}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <div className="text-sm text-muted-foreground">
                Page {page} / {pageCount}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                disabled={page >= pageCount}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
