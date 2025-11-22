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
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/Logo.png" alt="DatumInt Logo" className="h-8 w-8" />
              <div>
                <h1 className="text-2xl font-medium text-foreground">
                  Datum<span className="text-primary">Int</span>
                </h1>
                <p className="text-sm text-muted-foreground">Convert CSV, JSON, and more — instantly.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className="gap-2"
              >
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Feedback</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactOpen(true)}
                className="gap-2"
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">Contact</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
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