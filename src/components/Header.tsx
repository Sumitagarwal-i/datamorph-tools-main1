import { useState } from "react";
import { Moon, Sun, MessageSquare, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { FeedbackModal } from "./FeedbackModal";
import { ContactModal } from "./ContactModal";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-card overflow-x-hidden shadow-[0_6px_12px_-8px_rgba(0,0,0,0.12)]">
        <div className="container py-2 sm:py-2.5">
          <div className="flex items-center justify-between gap-2 max-w-full">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink overflow-hidden">
              <img src="/Logo.png" alt="DatumInt Logo" className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0" />
              <div className="min-w-0 overflow-hidden">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-medium text-foreground truncate">
                  Datum<span className="text-primary">Int</span>
                </h1>
                {/* removed subheading as requested */}
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/detective-d')}
                className="gap-1 px-3 sm:px-4 h-9 rounded-[0.5rem] border border-border text-gray-900 dark:text-white font-semibold relative"
              >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-9 w-9 flex-shrink-0">
                    {/* Detective D Logo - zoom-in magnifier (circle + plus) with prominent handle */}
                    <circle cx="11" cy="11" r="6.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    {/* plus sign for zoom-in */}
                    <path d="M11 8.5v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    <path d="M8.5 11h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    {/* handle - angled down-right, thicker and connected to circle */}
                    <path d="M15.2 15.2 L20 20" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
                  </svg>
                <span className="hidden sm:inline text-xs">DETECTIVE D</span>
                {/* removed "Smart Fix" label and arrow icon as requested */}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className="gap-1 px-2 sm:px-3 min-h-[32px] rounded-[0.5rem]"
              >
                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs">Feedback</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setContactOpen(true)}
                className="gap-1 px-2 sm:px-3 min-h-[32px] rounded-[0.5rem]"
              >
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="hidden sm:inline text-xs">Contact</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 rounded-full border border-border p-0"
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