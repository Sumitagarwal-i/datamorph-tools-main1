import { useState, useEffect } from "react";
import { ArrowRight, Sparkles, Zap, X } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate } from "react-router-dom";

interface BannerSlide {
  id: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta?: {
    text: string;
    action: () => void;
  };
  gradient: string;
  illustration?: React.ReactNode;
}

export const AnnouncementBanner = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isVisible, setIsVisible] = useState(true);
  const navigate = useNavigate();

  const slides: BannerSlide[] = [
    {
      id: 1,
      icon: <Sparkles className="h-5 w-5 text-amber-500" />,
      title: "New: More Actions Tab",
      description: "Auto-detect JSON/CSV + Beautify, Minify, Validate & Repair both formats instantly. Try demo data with one click!",
      gradient: "bg-white dark:bg-gray-900",
    },
    {
      id: 2,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-primary">
          <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M15 15L19.5 19.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M7.5 10.5H13.5M10.5 7.5V13.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <circle cx="8" cy="8" r="0.8" fill="currentColor"/>
          <circle cx="13" cy="8" r="0.8" fill="currentColor"/>
          <circle cx="8" cy="13" r="0.8" fill="currentColor"/>
          <circle cx="13" cy="13" r="0.8" fill="currentColor"/>
        </svg>
      ),
      title: "Introducing Inspect",
      description: "Your agent for deep error detection and smart data repair. Coming soon!",
      cta: {
        text: "Try Our Flagship Feature",
        action: () => navigate('/inspect'),
      },
      gradient: "bg-white dark:bg-gray-900",
    },
  ];

  // Auto-rotate slides every 5 seconds
  useEffect(() => {
    if (!isVisible) return;
    
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isVisible, slides.length]);

  if (!isVisible) return null;

  const currentSlideData = slides[currentSlide];

  return (
    <div className="relative overflow-hidden bg-white dark:bg-gray-900 border-b border-primary/10 transition-all duration-700 ease-in-out">
      <div className="container relative">
        <div className="flex items-center justify-between gap-4 py-3 sm:py-3.5">
          {/* Left side - Icon and content */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-lg flex items-center justify-center transform transition-transform duration-300 hover:scale-110">
              {currentSlideData.icon}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-sm sm:text-base text-gray-900 dark:text-gray-100">
                  {currentSlideData.title}
                </h3>
                {currentSlide === 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/20 text-primary border border-primary/30 animate-pulse">
                    NEW
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 mt-0.5 line-clamp-1 sm:line-clamp-none">
                {currentSlideData.description}
              </p>
            </div>
          </div>

          {/* Right side - CTA and controls */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {currentSlideData.cta && (
              <Button
                onClick={currentSlideData.cta.action}
                size="sm"
                className="hidden sm:flex gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 rounded-[16px] font-semibold"
              >
                {currentSlideData.cta.text}
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
            
            {/* Slide indicators */}
            <div className="hidden md:flex items-center gap-1.5">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-6 bg-primary' 
                      : 'bg-gray-400 dark:bg-gray-600 hover:bg-primary/50'
                  }`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsVisible(false)}
              className="p-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Close banner"
            >
              <X className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Illustration */}
      {currentSlideData.illustration}
    </div>
  );
};
