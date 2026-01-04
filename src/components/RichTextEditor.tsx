import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Node } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getPublicUrl, uploadToSupabaseWithProgress } from "@/lib/blog";
import { toast } from "sonner";

type Props = {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  slug?: string;
};

const ToolbarButton = ({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) => {
  return (
    <Button
      type="button"
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="h-8 px-2"
    >
      {children}
    </Button>
  );
};

const isSafeSlugForPath = (slug: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const sanitizeFilename = (name: string) =>
  name
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]+/g, "")
    .slice(0, 80);

const buildInlineStoragePath = (params: { kind: "image" | "video"; slug: string; file: File }) => {
  const { kind, slug, file } = params;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const safeName = sanitizeFilename(file.name || "upload");
  return `inline/${slug}/${kind}/${stamp}-${safeName}`;
};

const RichTextEditor = ({ value, onChange, className, slug }: Props) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);

  const safeSlug = useMemo(() => {
    const s = (slug ?? "").trim();
    return s && isSafeSlugForPath(s) ? s : "draft";
  }, [slug]);

  const IframeEmbed = useMemo(
    () =>
      Node.create({
        name: "iframe",
        group: "block",
        atom: true,
        selectable: true,
        addAttributes() {
          return {
            src: { default: null },
            title: { default: "Embedded content" },
            width: { default: "100%" },
            height: { default: "360" },
            allow: { default: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" },
            allowfullscreen: { default: "true" },
            frameborder: { default: "0" },
          };
        },
        parseHTML() {
          return [{ tag: "iframe" }];
        },
        renderHTML({ HTMLAttributes }) {
          return [
            "div",
            { class: "my-6" },
            [
              "div",
              { class: "relative w-full overflow-hidden rounded-xl border border-border bg-muted/20", style: "padding-top:56.25%" },
              [
                "iframe",
                {
                  ...HTMLAttributes,
                  class: "absolute left-0 top-0 h-full w-full",
                },
              ],
            ],
          ];
        },
      }),
    []
  );

  const VideoEmbed = useMemo(
    () =>
      Node.create({
        name: "video",
        group: "block",
        atom: true,
        selectable: true,
        addAttributes() {
          return {
            src: { default: null },
            controls: { default: true },
            preload: { default: "metadata" },
            poster: { default: null },
          };
        },
        parseHTML() {
          return [{ tag: "video" }];
        },
        renderHTML({ HTMLAttributes }) {
          return [
            "div",
            { class: "my-6" },
            [
              "video",
              {
                ...HTMLAttributes,
                class: "w-full rounded-xl border border-border bg-black/5",
                controls: HTMLAttributes.controls ? "controls" : undefined,
                preload: HTMLAttributes.preload ?? "metadata",
              },
            ],
          ];
        },
      }),
    []
  );

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "rounded-xl",
        },
      }),
      Link.extend({
        addAttributes() {
          return {
            ...this.parent?.(),
            class: { default: null },
          };
        },
      }).configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
      IframeEmbed,
      VideoEmbed,
    ],
    [IframeEmbed, VideoEmbed]
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert max-w-none focus:outline-none min-h-[240px]",
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  const uploadAndGetPublicUrl = async (params: { bucket: string; path: string; file: File; label: string }) => {
    const { bucket, path, file, label } = params;

    setUploading(true);
    setUploadLabel(label);
    setUploadPct(0);
    try {
      await uploadToSupabaseWithProgress({
        bucket,
        path,
        file,
        onProgress: (pct) => setUploadPct(pct),
      });

      const url = getPublicUrl(bucket, path);
      if (!url) throw new Error("Failed to generate public URL");
      return url;
    } finally {
      setUploading(false);
      setUploadLabel(null);
      setUploadPct(null);
    }
  };

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current === (value || "")) return;
    if (editor.isFocused) return;
    editor.commands.setContent(value || "", false);
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("rounded-md border border-border bg-background p-3", className)}>
        <div className="h-8 w-full animate-pulse rounded bg-muted" />
        <div className="mt-3 h-24 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border border-border bg-background", className)}>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-2">
        <ToolbarButton
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>
        <ToolbarButton active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          Bold
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          Italic
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          Bullets
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          Numbered
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          Quote
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive("link")}
          onClick={() => {
            const prev = editor.getAttributes("link").href as string | undefined;
            const url = window.prompt("Link URL", prev || "https://");
            if (!url) {
              editor.chain().focus().unsetLink().run();
              return;
            }
            editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          Link
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            const label = window.prompt("Button text", "Read more");
            if (!label) return;
            const href = window.prompt("Button link (https://…)", "https://");
            if (!href) return;

            const trimmedHref = href.trim();
            if (!trimmedHref) return;

            const safeLabel = label.trim();
            if (!safeLabel) return;

            // Insert as a styled link so it can appear inline anywhere in the blog.
            editor
              .chain()
              .focus()
              .insertContent(
                `<a href="${trimmedHref}" target="_blank" rel="noopener noreferrer" class="blog-cta-button">${safeLabel}</a>`
              )
              .run();
          }}
        >
          Button
        </ToolbarButton>

        <ToolbarButton
          onClick={() => {
            const url = window.prompt("Embed URL (https://…)", "https://");
            if (!url) return;
            const trimmed = url.trim();
            if (!/^https:\/\//i.test(trimmed)) return;
            editor.chain().focus().insertContent({ type: "iframe", attrs: { src: trimmed } }).run();
          }}
        >
          Embed
        </ToolbarButton>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !editor) return;

            try {
              const path = buildInlineStoragePath({ kind: "image", slug: safeSlug, file });
              const url = await uploadAndGetPublicUrl({
                bucket: "blog-images",
                path,
                file,
                label: "Uploading image…",
              });
              editor.chain().focus().setImage({ src: url, alt: file.name || "image" }).run();
              toast.success("Image inserted");
            } catch (err: any) {
              toast.error(err?.message || "Failed to upload image");
            }
          }}
        />

        <ToolbarButton
          onClick={() => {
            if (uploading) return;
            imageInputRef.current?.click();
          }}
        >
          Image
        </ToolbarButton>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file || !editor) return;

            try {
              const path = buildInlineStoragePath({ kind: "video", slug: safeSlug, file });
              const url = await uploadAndGetPublicUrl({
                bucket: "blog-media",
                path,
                file,
                label: "Uploading video…",
              });
              editor.chain().focus().insertContent({ type: "video", attrs: { src: url, controls: true } }).run();
              toast.success("Video inserted");
            } catch (err: any) {
              toast.error(err?.message || "Failed to upload video");
            }
          }}
        />

        <ToolbarButton
          onClick={() => {
            if (uploading) return;
            videoInputRef.current?.click();
          }}
        >
          Video
        </ToolbarButton>

        {uploading && (
          <div className="ml-auto text-xs text-muted-foreground">
            {uploadLabel}
            {typeof uploadPct === "number" ? ` ${uploadPct}%` : ""}
          </div>
        )}
      </div>

      <div className="p-3">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};

export default RichTextEditor;
