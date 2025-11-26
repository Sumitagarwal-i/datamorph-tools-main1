import { useState } from "react";
import { Moon, Sun, MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { FeedbackModal } from "./FeedbackModal";
import { ContactModal } from "./ContactModal";

export const Header = () => {
  const { theme, setTheme } = useTheme();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <header className="border-b border-border bg-card overflow-x-hidden">
        <div className="container py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2 max-w-full">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink overflow-hidden">
              <img src="/Logo.png" alt="DatumInt Logo" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
              <div className="min-w-0 overflow-hidden">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground truncate">
                  Datum<span className="text-primary">Int</span>
                </h1>
                <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground truncate">Convert CSV, JSON, and more — instantly.</p>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className="gap-1 px-2 sm:px-3 min-h-[32px]"
              >
                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs">Feedback</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactOpen(true)}
                className="gap-1 px-2 sm:px-3 min-h-[32px]"
              >
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs">Contact</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0"
              >
                <Sun className="h-4 w-4 sm:h-5 sm:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 sm:h-5 sm:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <ContactModal open={contactOpen} onOpenChange={setContactOpen} />
    </>
  );
};