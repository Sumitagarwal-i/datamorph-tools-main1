import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Database,
  FileText,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

const SAMPLE_DATASET_NAME = "sample-users.csv";
const SAMPLE_DATASET_CONTENT = `id,email,age,signup_date,country,plan\n1,alice@example.com,29,2025-11-01,US,pro\n2,bob@example.com,,2025-11-05,GB,free\n3,carol@example,34,not-a-date,DE,pro\n4,dave@example.com,130,2025-11-07,US,pro\n`;

const ACCEPT = ".csv,.txt,.json,.xlsx,.xls,application/json,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel";

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

type LoadedState =
  | { kind: "empty" }
  | { kind: "paste"; name: string; content: string }
  | { kind: "file"; name: string; content: string; sizeBytes: number };

export function InspectEntryPanel() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [errorText, setErrorText] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedState>({ kind: "empty" });

  const continueEnabled = useMemo(() => {
    if (loading) return false;
    if (loaded.kind === "paste") return loaded.content.trim().length > 0;
    if (loaded.kind === "file") return loaded.content.trim().length > 0;
    return false;
  }, [loaded, loading]);

  const openPicker = () => inputRef.current?.click();

  const guessPasteName = (raw: string) => {
    const trimmed = raw.trimStart();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) return "pasted-data.json";
    return "pasted-data.csv";
  };

  const setPasteMode = (next: string) => {
    setErrorText(null);
    setPasteOpen(true);
    setPasteText(next);
    const content = next;
    if (content.trim().length > 0) {
      setLoaded({ kind: "paste", name: guessPasteName(content), content });
    } else {
      setLoaded({ kind: "empty" });
    }
  };

  const clearAll = () => {
    setErrorText(null);
    setLoading(false);
    setPasteOpen(false);
    setPasteText("");
    setLoaded({ kind: "empty" });
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file: File) => {
    setErrorText(null);
    setPasteOpen(false);
    setPasteText("");

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      setLoaded({ kind: "empty" });
      setErrorText("Excel files aren’t supported in Inspect yet — please upload CSV or JSON.");
      return;
    }

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = (event.target?.result as string) || "";
      setLoaded({ kind: "file", name: file.name, content, sizeBytes: file.size });
      setLoading(false);
    };
    reader.onerror = () => {
      setLoaded({ kind: "empty" });
      setErrorText("Could not read that file.");
      setLoading(false);
    };
    reader.readAsText(file);
  };

  const handleContinue = () => {
    if (!continueEnabled) return;

    const payload =
      loaded.kind === "file"
        ? { name: loaded.name, content: loaded.content, source: "upload" as const }
        : loaded.kind === "paste"
          ? { name: loaded.name, content: loaded.content, source: "paste" as const }
          : null;

    if (!payload) return;

    navigate("/inspect", {
      state: {
        inspectPreload: payload,
      },
    });
  };

  const dropZoneBorder = isDragging
    ? "border-blue-500 border-solid"
    : "border-[#D5D9E0] dark:border-[#2A2E33] border-dashed";

  const dropZoneBg = isDragging
    ? "bg-blue-50/60 dark:bg-blue-500/10"
    : "bg-white dark:bg-[#0F1113]";

  return (
    <TooltipProvider>
    <div className="w-full max-w-xl">
      <div
        className={`rounded-2xl border ${dropZoneBorder} ${dropZoneBg} shadow-sm transition-colors duration-200 overflow-hidden`}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        {/* Content area */}
        <div className="px-6 py-8 min-h-[240px] flex items-center justify-center">
          {loaded.kind === "file" ? (
            <div className="w-full max-w-md">
              <div className="flex items-start justify-between gap-3 rounded-xl border border-[#EAEAEA] dark:border-[#1E1E1E] bg-[#F8F9FA] dark:bg-[#101113] p-4">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8] truncate">
                    {loaded.name}
                  </div>
                  <div className="mt-1 text-xs text-[#6B6B6B] dark:text-[#8B8B8B]">
                    {formatBytes(loaded.sizeBytes)}
                    {loading ? " • Loading…" : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={clearAll}
                  className="shrink-0 inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6B6B6B] dark:text-[#A8A8A8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Remove file"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {errorText ? (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400">{errorText}</div>
              ) : null}
            </div>
          ) : pasteOpen ? (
            <div className="w-full">
              <div className="relative">
                <textarea
                  value={pasteText}
                  onChange={(e) => {
                    const next = e.target.value;
                    setPasteText(next);
                    setErrorText(null);
                    if (next.trim().length > 0) {
                      setLoaded({ kind: "paste", name: guessPasteName(next), content: next });
                    } else {
                      setLoaded({ kind: "empty" });
                    }
                  }}
                  placeholder="Paste CSV or JSON…"
                  className="w-full min-h-[180px] resize-none rounded-xl border border-[#EAEAEA] dark:border-[#1E1E1E] bg-white dark:bg-[#0F1113] px-4 py-3 text-sm font-mono text-[#1A1A1A] dark:text-[#E8E8E8] placeholder:text-[#8B8B8B] focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
                {/* Dismiss textarea and return to drag/drop state */}
                <button
                  type="button"
                  onClick={clearAll}
                  className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-lg text-[#6B6B6B] dark:text-[#A8A8A8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  aria-label="Dismiss paste mode"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* Small clear button for textarea */}
                <button
                  type="button"
                  onClick={() => setPasteText("")}
                  className="absolute bottom-3 right-3 inline-flex h-6 px-2 items-center justify-center rounded bg-[#F3F4F6] dark:bg-[#23262A] text-xs text-[#6B6B6B] dark:text-[#A8A8A8] hover:bg-[#E5E7EB] dark:hover:bg-[#181A1B] transition-colors border border-[#EAEAEA] dark:border-[#23262A]"
                  aria-label="Clear text"
                  style={{ fontSize: "0.75rem" }}
                >
                  Clear
                </button>
              </div>
              {errorText ? (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400">{errorText}</div>
              ) : null}
            </div>
          ) : (
            <div className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-black/5 dark:bg-white/5 flex items-center justify-center">
                <Upload className="h-7 w-7 text-[#4B5563] dark:text-[#A8A8A8]" />
              </div>
              <div className="mt-5 text-xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                Drag and drop your file here
              </div>
              <div className="mt-1 text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
                or use one of the options below
              </div>
              {errorText ? (
                <div className="mt-3 text-xs text-red-600 dark:text-red-400">{errorText}</div>
              ) : null}
            </div>
          )}
        </div>

        {/* Action bar */}
        <div className="border-t border-[#EAEAEA] dark:border-[#1E1E1E] bg-[#F8F9FA] dark:bg-[#101113] px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#4B5563] dark:text-[#A8A8A8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    aria-label="Attach file"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Attach file</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPasteMode(pasteText)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#4B5563] dark:text-[#A8A8A8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    aria-label="Paste data"
                  >
                    <FileText className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Paste data</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setPasteMode(SAMPLE_DATASET_CONTENT)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[#4B5563] dark:text-[#A8A8A8] hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                    aria-label="Load sample"
                  >
                    <Database className="h-5 w-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Load sample</TooltipContent>
              </Tooltip>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  onClick={handleContinue}
                  disabled={!continueEnabled}
                  className="h-10 w-10 p-0 rounded-lg bg-[#4F7CFF] hover:bg-[#3F6AE0] active:bg-[#3559C7] disabled:bg-[#D5D9E0] disabled:text-[#9AA0A6] disabled:opacity-100"
                  aria-label="Continue"
                >
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Continue</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
            e.target.value = "";
          }}
          className="hidden"
        />
      </div>
    

      {/* Ensure sample name is consistent when using sample */}
      {loaded.kind === "paste" && loaded.content === SAMPLE_DATASET_CONTENT ? (
        <div className="sr-only">{SAMPLE_DATASET_NAME}</div>
      ) : null}
    </div>
    </TooltipProvider>
  );
}
