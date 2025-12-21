import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { 
  ChevronLeft, 
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SlideData {
  id: number;
  headline: string;
  subtext: string;
  image: string;
  cta?: string;
}

export function DetectiveDBanner() {
  const navigate = useNavigate();
  const slides: SlideData[] = [
    {
      id: 0,
      headline: "Detective D Beta is Live!",
      subtext: "Your AI agent for deep error detection and anomaly repair.",
      image: "/b1.webp",
      cta: "Try Beta Now"
    },
    {
      id: 1,
      headline: "Upload your data. We'll understand it.",
      subtext: "Paste or upload JSON, CSV, XML, or YAML. DatumInt automatically performs structural checks and highlights what's broken.",
      image: "/b2.webp"
    },
    {
      id: 2,
      headline: "Detective D spots hidden data issues.",
      subtext: "Go beyond syntax. Find suspicious rows, invalid values, and logic inconsistencies that break downstream systems.",
      image: "/b3.webp"
    },
    {
      id: 3,
      headline: "Download clear error reports.",
      subtext: "Get a structured report with every issue, explanation, and suggested fix — ready to share or audit.",
      image: "/b4.webp"
    }
  ];

  // state
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
  };

  // Auto-rotate: advance every 5s when not hovered
  useEffect(() => {
    if (isHovered) return;
    const id = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [isHovered, slides.length]);

  return (
    <div id="detective-d-banner" className="w-full max-w-[64rem] mx-auto px-2 sm:px-5 md:px-7 lg:px-10 mt-6 sm:mt-8 lg:mt-10 mb-4">
      <Card onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} className="w-full relative overflow-hidden bg-white border border-slate-300 shadow-sm rounded-md">
        <CardContent className="p-0">
          <div className="flex flex-col md:flex-row min-h-[240px] md:h-[280px] relative">
            {/* Content Section */}
            <div className="flex-1 p-8 md:p-12 flex flex-col justify-center relative z-10 pb-16">
              <div className={slides[currentSlide].cta ? "space-y-3 max-w-xl" : "space-y-6 max-w-xl"}>
                <h2 className="text-2xl md:text-4xl font-medium text-slate-900 tracking-tight leading-tight">
                  {slides[currentSlide].headline}
                </h2>
                <p className="text-slate-600 text-lg leading-relaxed max-w-md">
                  {slides[currentSlide].subtext}
                </p>

                {/* CTA for the first banner slide */}
                {slides[currentSlide].cta ? (
                  <div className="pt-1">
                    <button
                      onClick={() => navigate('/detective-d')}
                      aria-label="Try Detective D Beta"
                      className="inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full shadow-sm px-3 py-1.5 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <span className="whitespace-nowrap">{slides[currentSlide].cta}</span>
                    </button>
                  </div>
                ) : null}
              </div>
                
              {/* Navigation Dots - Fixed position */}
              <div className="absolute bottom-5 left-8 md:left-12 flex items-center gap-1.5">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.id}
                      onClick={() => goToSlide(index)}
                      className={cn(
                        "w-1.5 h-1.5 rounded-full transition-all duration-300",
                        currentSlide === index 
                          ? "bg-slate-800 w-6" 
                          : "bg-slate-300 hover:bg-slate-400"
                      )}
                      aria-label={`Go to slide ${index + 1}`}
                    />
                  ))}
                </div>
            </div>

            {/* Visual Section */}
            <div className="flex-1 flex items-center justify-end overflow-hidden">
              <img 
                src={slides[currentSlide].image} 
                alt={slides[currentSlide].headline}
                className="h-full w-full object-cover object-right"
              />
            </div>
          </div>

          {/* Arrow Navigation (Optional, for better accessibility/usability) */}
          <button 
            onClick={prevSlide}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-sm border border-slate-100 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity md:hidden"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button 
            onClick={nextSlide}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/80 hover:bg-white shadow-sm border border-slate-100 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity md:hidden"
            aria-label="Next slide"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
