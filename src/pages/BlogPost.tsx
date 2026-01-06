import { useParams, useNavigate, useLocation } from "react-router-dom";
import { toast } from "@/components/ui/sonner";
import { BlogHeader } from "@/components/BlogHeader";
import { Footer } from "@/components/Footer";
import { Clock, ArrowLeft, Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { slugify } from "@/lib/blog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/ToastContext";
import { isAdminAuthed } from "@/lib/adminAuth";
import { getPublicUrl } from "@/lib/blog";
import { Seo } from "@/components/Seo";

type BlogRow = Tables<"blogs">;

type TocItem = { id: string; text: string; level: 2 | 3 };

const formatPublishDate = (yyyyMmDd: string) => {
  const d = new Date(yyyyMmDd);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const buildTocAndHtml = (html: string) => {
  const doc = new DOMParser().parseFromString(html || "", "text/html");
  const headings = Array.from(doc.querySelectorAll("h2, h3"));

  const used = new Set<string>();
  const toc: TocItem[] = [];

  for (const heading of headings) {
    const level = heading.tagName.toLowerCase() === "h2" ? 2 : 3;
    const text = (heading.textContent ?? "").trim();
    if (!text) continue;

    let id = heading.getAttribute("id") || slugify(text);
    if (!id) continue;
    let next = id;
    let n = 2;
    while (used.has(next)) {
      next = `${id}-${n++}`;
    }
    id = next;
    used.add(id);
    heading.setAttribute("id", id);

    toc.push({ id, text, level });
  }

  return { html: doc.body.innerHTML, toc };
};

const BlogPost = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const previewAllowed = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get("preview") === "1" && isAdminAuthed();
  }, [location.search]);

  const [post, setPost] = useState<BlogRow | null>(null);
  const [processedHtml, setProcessedHtml] = useState<string>("");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [related, setRelated] = useState<Pick<BlogRow, "id" | "title" | "slug" | "publish_date" | "read_time" | "category">[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [audioPlaying, setAudioPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!slug) return;
      setLoading(true);
      setNotFound(false);

      let query = supabase.from("blogs").select("*").eq("slug", slug);
      if (!previewAllowed) {
        query = query.eq("status", "Published");
      }

      const { data, error } = await query.maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        setPost(null);
        setProcessedHtml("");
        setToc([]);
        setRelated([]);
        setNotFound(true);
        setLoading(false);
        return;
      }

      const row = data as BlogRow;
      setPost(row);
      const built = buildTocAndHtml(row.content);
      setProcessedHtml(built.html);
      setToc(built.toc);

      const { data: relatedData } = await supabase
        .from("blogs")
        .select("id,title,slug,publish_date,read_time,category")
        .eq("status", "Published")
        .eq("category", row.category)
        .neq("slug", row.slug)
        .order("publish_date", { ascending: false })
        .limit(3);

      if (!cancelled) {
        setRelated((relatedData ?? []) as any);
        setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [slug, previewAllowed]);

  const shareUrl = useMemo(() => {
    if (!slug) return "";
    return `${window.location.origin}/blog/${slug}`;
  }, [slug]);

  if (!loading && notFound) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Seo
          title="Post not found | DatumInt"
          description="This article could not be found. Explore the latest posts on data quality and file-level validation."
          path="/blog"
        />
        <BlogHeader />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-4">Post not found</h1>
            <button
              onClick={() => navigate("/blog")}
              className="text-[#4F7CFF] hover:underline"
            >
              Back to Blog
            </button>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (loading || !post) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Seo
          title="Loading… | DatumInt"
          description="Loading the article."
          path={slug ? `/blog/${slug}` : "/blog"}
        />
        <BlogHeader />
        <div className="flex-grow flex items-center justify-center text-muted-foreground">Loading…</div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Seo
        title={`${post.title} | DatumInt`}
        description={post.description}
        path={`/blog/${post.slug}`}
      />
      <BlogHeader />

      <article
        className="flex-grow container max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16"
      >
        {/* Back Link */}
        <button
          onClick={() => navigate("/blog")}
          className="group flex items-center text-sm text-muted-foreground hover:text-foreground mb-8 sm:mb-12 transition-colors"
        >
          <ArrowLeft className="mr-2 h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to Blog
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-10">
          <div>
            {/* 4.1 Article Header */}
            <header className="mb-10 text-center">
              <div className="inline-block px-3 py-1 mb-6 text-xs font-medium tracking-wider text-[#4F7CFF] uppercase bg-[#F5F8FF] dark:bg-[#1A1F2E] rounded-full">
                {post.category}
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground mb-6 leading-tight">
                {post.title}
              </h1>
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <span>{formatPublishDate(post.publish_date)}</span>
                <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {(post.read_time ?? 1) + " min"}
                </span>
                <span className="w-1 h-1 bg-muted-foreground/30 rounded-full" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast().success("Link copied");
                    } catch {
                      toast().error("Could not copy link");
                    }
                  }}
                >
                  Copy link
                </Button>
              </div>

              {(() => {
                const audioPath = post.audio_path;
                const url = getPublicUrl("blog-media", audioPath);
                if (!audioPath || !url) return null;
                return (
                  <div className="mt-4 flex flex-col items-center gap-3">
                    <audio
                      ref={audioRef}
                      src={url}
                      preload="none"
                      controls
                      controlsList="nodownload"
                      className="w-full max-w-xl"
                      onPlay={() => setAudioPlaying(true)}
                      onPause={() => setAudioPlaying(false)}
                      onEnded={() => setAudioPlaying(false)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const el = audioRef.current;
                        if (!el) return;
                        if (audioPlaying) {
                          el.pause();
                          setAudioPlaying(false);
                          return;
                        }
                        void el.play();
                        setAudioPlaying(true);
                      }}
                    >
                      {audioPlaying ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                      Listen
                    </Button>
                  </div>
                );
              })()}
            </header>

            {/* 4.2 Article Body */}
            <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-[#4F7CFF] prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-p:my-5 prose-h2:mt-10 prose-h2:mb-4 prose-h3:mt-8 prose-h3:mb-3 prose-ul:my-5 prose-ol:my-5 prose-li:my-2 prose-blockquote:my-6 prose-hr:my-10">
              <div dangerouslySetInnerHTML={{ __html: processedHtml }} />
            </div>

            {/* Related */}
            {related.length > 0 && (
              <div className="mt-16 pt-10 border-t border-[#EAEAEA] dark:border-[#1F1F1F]">
                <h2 className="text-lg font-semibold text-foreground mb-4">Related posts</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {related.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => navigate(`/blog/${r.slug}`)}
                      className="text-left rounded-lg border border-[#EAEAEA] dark:border-[#1F1F1F] p-4 hover:bg-[#F7F7F8] dark:hover:bg-[#151515] transition"
                    >
                      <div className="text-xs font-medium text-[#4F7CFF] uppercase tracking-wider mb-2">
                        {r.category}
                      </div>
                      <div className="font-medium text-foreground line-clamp-2">{r.title}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {formatPublishDate(r.publish_date)} • {(r.read_time ?? 1) + " min"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 4.4 Article Footer */}
            <div className="mt-16 pt-8 border-t border-[#EAEAEA] dark:border-[#1F1F1F]">
              <p className="text-muted-foreground italic mb-4">
                If you’ve seen similar failures, we’d genuinely like to learn from you.
              </p>
              <a
                href="#"
                className="text-[#4F7CFF] font-medium hover:underline"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = "mailto:sumitagar4@gmail.com";
                }}
              >
                Share your story →
              </a>
            </div>
          </div>

          {/* TOC */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 rounded-lg border border-[#EAEAEA] dark:border-[#1F1F1F] p-4">
              <div className="text-sm font-medium text-foreground mb-3">On this page</div>
              {toc.length === 0 ? (
                <div className="text-sm text-muted-foreground">No sections</div>
              ) : (
                <nav className="space-y-2">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block text-sm transition-colors hover:text-foreground ${
                        item.level === 3 ? "pl-4 text-muted-foreground" : "text-muted-foreground"
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              )}
            </div>
          </aside>
        </div>
      </article>

      <Footer />
    </div>
  );
};

export default BlogPost;
