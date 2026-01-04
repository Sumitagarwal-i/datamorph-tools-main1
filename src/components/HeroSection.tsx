import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useParallax } from "@/hooks/useParallax";

export const HeroSection = () => {
  const navigate = useNavigate();
  const { ref, offset } = useParallax(0.3);

  const handleInspectClick = () => {
    navigate('/inspect');
  };

  const handleSeeHowItWorks = () => {
    const section = document.getElementById('how-it-works');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section ref={ref} className="w-full bg-white dark:bg-[#0F0F0F] border-b border-[#EAEAEA] dark:border-[#1E1E1E] relative overflow-hidden">
      {/* Parallax Background Layer */}
      <div 
        className="absolute inset-0 -z-10"
        style={{
          transform: `translateY(${offset}px)`,
          background: 'linear-gradient(180deg, #F8F9FA 0%, #FFFFFF 100%)',
        }}
      />
      <div 
        className="absolute inset-0 -z-10 dark:opacity-100 opacity-0"
        style={{
          transform: `translateY(${offset}px)`,
          background: 'linear-gradient(180deg, #1A1A1A 0%, #0F0F0F 100%)',
        }}
      />
      {/* Container */}
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20 lg:py-28">
        {/* Two-column layout on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Column - Text Content */}
          <div className="flex flex-col gap-8 items-start max-w-3xl">
            {/* Headline */}
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-tight">
              Inspect files that look valid<br />
              <span className="text-[#4F7CFF] dark:text-[#6B9FFF]">but break later.</span>
            </h1>
            {/* Subheadline */}
            <p className="text-lg sm:text-lg text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
              DatumInt is a lightweight inspection layer for structured data. It helps developers catch hidden structural and data quality issues early, before they cascade into downstream systems.
            </p>
            {/* CTA Section */}
            <div className="flex flex-col gap-4 w-full">
              {/* Primary CTA Button */}
              <button
                onClick={handleInspectClick}
                className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white rounded-[8px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/40 w-fit"
                style={{
                  backgroundColor: '#4F7CFF',
                  boxShadow: '0 1.5px 6px 0 rgba(79,124,255,0.10)'
                }}
                onMouseOver={e => (e.currentTarget.style.backgroundColor = '#3F6AE0')}
                onMouseOut={e => (e.currentTarget.style.backgroundColor = '#4F7CFF')}
              >
                Inspect a file
                <ArrowRight className="ml-2 h-4 w-4" />
              </button>
              {/* Secondary CTA (Text-only) */}
              <button
                onClick={handleSeeHowItWorks}
                className="inline-flex items-center justify-start text-sm font-normal text-[#1A1A1A] dark:text-[#E8E8E8] hover:text-[#4F7CFF] dark:hover:text-[#6B9FFF] transition-colors w-fit gap-2 ml-4"
              >
                See how it works
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            {/* Trust Hint */}
            <div className="pt-2">
              <p className="text-xs sm:text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
                No signup required • Files processed securely
              </p>
            </div>
          </div>

          {/* Right Column - Visual Illustration */}
          <div className="hidden lg:flex justify-center items-center h-full">
            <img
              src="/perfect_hero.webp"
              alt="DatumInt file inspection illustration"
              decoding="async"
              fetchPriority="high"
              className="w-full h-full object-contain"
              draggable="false"
            />
          </div>

        </div>
      </div>
    </section>
  );
};
