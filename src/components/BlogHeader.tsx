import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FeedbackModal } from "./FeedbackModal";
import { MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const BlogHeader = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header
        className={`sticky top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 dark:bg-[#0B0B0B]/80 backdrop-blur-md border-b border-[#EAEAEA] dark:border-[#1F1F1F]"
            : "bg-transparent border-b border-transparent"
        }`}
      >
        <div className="container h-full px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl flex items-center justify-between">
          {/* Left: Brand + Blog Label */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 hover:opacity-80 transition-opacity"
            >
              <img src="/Logo.png" alt="DatumInt Logo" className="h-7 w-7" />
              <span className="font-semibold text-foreground">DatumInt</span>
            </button>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">Blog</span>
          </div>

          {/* Right: Navigation */}
          <nav className="flex items-center gap-6">
            <button
              onClick={() => navigate("/")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Home
            </button>
            <button
              onClick={() => navigate("/inspect")}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Inspect
            </button>
            <button
              onClick={() => setFeedbackOpen(true)}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Feedback
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="p-2 hover:bg-muted/60 rounded-md transition-colors"
                  aria-label="Open menu"
                >
                  <MoreVertical className="h-5 w-5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => navigate("/admin")}>Admin</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>
      </header>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </>
  );
};
