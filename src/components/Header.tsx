import { useState } from "react";
import { Moon, Sun, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { FeedbackModal } from "./FeedbackModal";
import { SupportModal } from "./SupportModal";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleInspectClick = () => {
    navigate('/inspect');
    setMobileMenuOpen(false);
  };

  const handleBlogClick = () => {
    navigate('/blog');
    setMobileMenuOpen(false);
  };

  const handleFeedbackClick = () => {
    setFeedbackOpen(true);
    setMobileMenuOpen(false);
  };

  const handleSupportClick = () => {
    setSupportOpen(true);
    setMobileMenuOpen(false);
  };


  return (
    <>
      {/* Navbar Container - Height: 64px, Sticky */}
      <header className="sticky top-0 left-0 right-0 z-50 h-16 border-b bg-white dark:bg-[#0F0F0F] border-[#EAEAEA] dark:border-[#1E1E1E]">
        <div className="container h-full px-4 sm:px-6 lg:px-8 mx-auto max-w-7xl flex items-center justify-between">
          {/* Left Section - Brand */}
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img src="/Logo.png" alt="DatumInt Logo" className="h-7 w-7" />
            <span className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
              DatumInt
            </span>
          </button>

          {/* Desktop Navigation - Center/Right */}
          <nav className="hidden md:flex items-center gap-6">
            {/* Inspect - Primary Action */}
            <button
              onClick={handleInspectClick}
              className="px-4 py-2 text-sm font-bold text-white rounded-[8px] shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40"
              style={{
                minWidth: 90,
                backgroundColor: '#4F7CFF',
                boxShadow: '0 1.5px 6px 0 rgba(79,124,255,0.10)'
              }}
              onMouseOver={e => (e.currentTarget.style.backgroundColor = '#3F6AE0')}
              onMouseOut={e => (e.currentTarget.style.backgroundColor = '#4F7CFF')}
              onMouseDown={e => (e.currentTarget.style.backgroundColor = '#3559C7')}
              onMouseUp={e => (e.currentTarget.style.backgroundColor = '#3F6AE0')}
            >
              Inspect
            </button>

            {/* Blog */}
            <button
              onClick={handleBlogClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors hidden sm:block"
            >
              Blog
            </button>

            {/* Feedback */}
            <button
              onClick={handleFeedbackClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Feedback
            </button>

            {/* Support */}
            <button
              onClick={handleSupportClick}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Support
            </button>
          </nav>

          {/* Mobile - Hamburger Menu */}
          <div className="flex md:hidden items-center gap-2">
            {/* Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-[#F4F4F4] dark:hover:bg-[#1F1F1F] rounded-md transition-colors"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#EAEAEA] dark:border-[#1F1F1F] bg-white dark:bg-[#0B0B0B]">
            <nav className="container px-4 py-4 flex flex-col gap-2">
              <button
                onClick={handleInspectClick}
                className="px-4 py-3 text-left text-sm font-semibold text-foreground hover:bg-[#F4F4F4] dark:hover:bg-[#1F1F1F] rounded-md transition-colors"
              >
                Inspect
              </button>
              <button
                onClick={handleBlogClick}
                className="px-4 py-3 text-left text-sm font-normal text-foreground hover:bg-[#F4F4F4] dark:hover:bg-[#1F1F1F] rounded-md transition-colors"
              >
                Blog
              </button>
              <button
                onClick={handleFeedbackClick}
                className="px-4 py-3 text-left text-sm font-normal text-foreground hover:bg-[#F4F4F4] dark:hover:bg-[#1F1F1F] rounded-md transition-colors"
              >
                Feedback
              </button>
              <button
                onClick={handleSupportClick}
                className="px-4 py-3 text-left text-sm font-normal text-foreground hover:bg-[#F4F4F4] dark:hover:bg-[#1F1F1F] rounded-md transition-colors"
              >
                Support
              </button>

              {/* Admin entry removed from home header mobile menu */}
            </nav>
          </div>
        )}
      </header>

      <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      <SupportModal isOpen={supportOpen} onClose={() => setSupportOpen(false)} />
    </>
  );
};