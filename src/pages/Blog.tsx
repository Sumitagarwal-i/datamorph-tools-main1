import { BlogHeader } from "@/components/BlogHeader";
import { Footer } from "@/components/Footer";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Clock, Pause, Play } from "lucide-react";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { BLOG_CATEGORIES, getPublicUrl } from "@/lib/blog";
import { Button } from "@/components/ui/button";

type BlogRow = Tables<"blogs">;

const ListenButton = ({ audioPath, onNavigateBlock }: { audioPath: string | null; onNavigateBlock?: (e: any) => void }) => {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const url = useMemo(() => getPublicUrl("blog-media", audioPath), [audioPath]);

  if (!audioPath || !url) return null;

  return (
    <>
      <audio
        ref={audioRef}
        src={url}
        onEnded={() => setPlaying(false)}
        preload="none"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={(e) => {
          onNavigateBlock?.(e);
          e.preventDefault();
          e.stopPropagation();
          const el = audioRef.current;
          if (!el) return;
          if (playing) {
            el.pause();
            setPlaying(false);
            return;
          }
          void el.play();
          setPlaying(true);
        }}
      >
        {playing ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
        Listen
      </Button>
    </>
  );
};

const formatPublishDate = (yyyyMmDd: string) => {
  const d = new Date(yyyyMmDd);
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const Blog = () => {
  const navigate = useNavigate();
  const { ref, isVisible } = useFadeIn(0.1);

  const [posts, setPosts] = useState<BlogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>("All");

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("blogs")
        .select("*")
        .eq("status", "Published")
        .order("publish_date", { ascending: false });

      if (cancelled) return;

      if (error) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setPosts((data ?? []) as BlogRow[]);
      setLoading(false);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const fromDb = Array.from(new Set(posts.map((p) => p.category).filter(Boolean))) as string[];
    const base = [...BLOG_CATEGORIES];
    const merged = Array.from(new Set([...base, ...fromDb]));
    return ["All", ...merged];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    if (activeCategory === "All") return posts;
    return posts.filter((p) => p.category === activeCategory);
  }, [activeCategory, posts]);

  const featuredPost = filteredPosts[0] ?? null;
  const otherPosts = featuredPost
    ? filteredPosts.filter((p) => p.slug !== featuredPost.slug)
    : [];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B0B0B] flex flex-col">
      <BlogHeader />

      <main className="flex-grow container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
        {/* 3.1 Top Header Section */}
        <div className="mb-12 sm:mb-16 max-w-2xl">
          <p className="text-lg sm:text-xl leading-relaxed text-foreground">
            <span className="text-[#4F7CFF] font-medium">Notes</span> on data quality, schema drift, and why “valid” files still break pipelines.
          </p>
        </div>

        {/* 3.4 Filters (Minimal) */}
        <div className="flex flex-wrap gap-2 mb-12">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                cat === activeCategory
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary hover:text-foreground"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* 3.2 Featured Blog Section */}
        <div 
          ref={ref}
          className={`mb-16 sm:mb-24 transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          {!featuredPost ? (
            <div className="rounded-xl border border-[#EAEAEA] dark:border-[#262626] bg-[#F5F6F8] dark:bg-[#1A1A1A] p-10 text-center text-muted-foreground">
              {loading ? "Loading posts…" : "No published posts yet"}
            </div>
          ) : (
            <div
              onClick={() => navigate(`/blog/${featuredPost.slug}`)}
              className="group cursor-pointer grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
            >
              {/* Featured image (or placeholder) */}
              <div className="aspect-[16/9] lg:aspect-[4/3] rounded-xl overflow-hidden bg-[#F5F6F8] dark:bg-[#1A1A1A] border border-[#EAEAEA] dark:border-[#262626] relative">
                {featuredPost.featured_image_path ? (
                  (() => {
                    const url = getPublicUrl("blog-images", featuredPost.featured_image_path);
                    if (!url) return null;
                    return (
                      <img
                        src={url}
                        alt=""
                        className="absolute inset-0 h-full w-full object-cover"
                        loading="lazy"
                      />
                    );
                  })()
                ) : (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/5 dark:to-white/5" />
                    <div
                      className="absolute inset-0 opacity-30"
                      style={{
                        backgroundImage: "radial-gradient(#4F7CFF 1px, transparent 1px)",
                        backgroundSize: "24px 24px",
                      }}
                    />
                  </>
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col justify-center">
                <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
                  <span className="font-medium text-[#4F7CFF]">{featuredPost.category}</span>
                  <span>•</span>
                  <span>{formatPublishDate(featuredPost.publish_date)}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {(featuredPost.read_time ?? 1) + " min"}
                  </span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-semibold text-foreground mb-4 group-hover:text-[#4F7CFF] transition-colors">
                  {featuredPost.title}
                </h2>
                <p className="text-lg text-muted-foreground mb-6 line-clamp-3">{featuredPost.description}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center text-sm font-medium text-foreground group-hover:text-[#4F7CFF] transition-colors">
                    Read article <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                  <ListenButton audioPath={featuredPost.audio_path ?? null} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3.3 Blog List Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-12 sm:gap-y-16 border-t border-[#EAEAEA] dark:border-[#1F1F1F] pt-12 sm:pt-16">
          {otherPosts.map((post) => (
            <article
              key={post.slug}
              onClick={() => navigate(`/blog/${post.slug}`)}
              className="group cursor-pointer flex flex-col h-full"
            >
              <div className="mb-4 text-xs font-medium text-[#4F7CFF] uppercase tracking-wider">
                {post.category}
              </div>
              <h3 className="text-xl sm:text-2xl font-semibold text-foreground mb-3 group-hover:text-[#4F7CFF] transition-colors">
                {post.title}
              </h3>
              <p className="text-muted-foreground mb-4 flex-grow line-clamp-2">
                {post.description}
              </p>
              <div className="flex items-center gap-3 text-sm text-muted-foreground mt-auto">
                <span>{formatPublishDate(post.publish_date)}</span>
                <span>•</span>
                <span>{(post.read_time ?? 1) + " min"}</span>
                <ListenButton audioPath={post.audio_path ?? null} />
              </div>
            </article>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Blog;
