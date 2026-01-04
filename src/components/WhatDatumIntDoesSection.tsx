import { useFadeIn } from "@/hooks/useFadeIn";
import { useParallax } from "@/hooks/useParallax";

export const WhatDatumIntDoesSection = () => {
  const { ref: fadeRef, isVisible } = useFadeIn<HTMLElement>(0.1);
  const { ref: parallaxRef, offset } = useParallax<HTMLElement>(0.06);

  return (
    <section
      id="how-it-works"
      ref={(node) => {
        fadeRef.current = node;
        parallaxRef.current = node;
      }}
      className={`w-full bg-[#F8F9FA] dark:bg-[#141414] py-16 sm:py-20 lg:py-28 transition-all duration-700 relative overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Parallax background accents */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          transform: `translateY(${offset * 0.12}px)`,
          background: "linear-gradient(180deg, #FFFFFF 0%, #F8F9FA 70%, #F8F9FA 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-0 dark:opacity-100"
        style={{
          transform: `translateY(${offset * 0.12}px)`,
          background: "linear-gradient(180deg, #1A1A1A 0%, #141414 70%, #141414 100%)",
        }}
      />
      <div
        className="absolute -top-24 right-[-160px] h-[420px] w-[420px] rounded-full blur-3xl opacity-40 dark:opacity-20 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 30% 30%, rgba(79,124,255,0.20) 0%, rgba(79,124,255,0) 70%)",
        }}
      />
      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16 sm:mb-20">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Inspect files before they quietly break something
          </h2>
          <p className="text-lg text-[#6B6B6B] dark:text-[#A8A8A8] max-w-3xl mx-auto">
            DatumInt inspects files for structural and data-quality issues before they reach your pipeline or dashboard.
          </p>
        </div>

        {/* 3-Step Flow */}
        <div className="space-y-12 sm:space-y-16">
          {/* Step 1 */}
          <div className="flex gap-6 sm:gap-8 items-start">
            <div className="flex-shrink-0">
              <span className="text-5xl sm:text-6xl font-bold text-[#4F7CFF] opacity-30">01</span>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
                Automatic structure checks
              </h3>
              <p className="text-base sm:text-lg text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
                Files are validated for syntax, structure, and format issues as soon as they're uploaded: JSON, CSV, YAML, or XML.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#EAEAEA] dark:border-[#2A2A2A] opacity-50"></div>

          {/* Step 2 */}
          <div className="flex gap-6 sm:gap-8 items-start">
            <div className="flex-shrink-0">
              <span className="text-5xl sm:text-6xl font-bold text-[#4F7CFF] opacity-30">02</span>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
                Inspect data quality and consistency
              </h3>
              <p className="text-base sm:text-lg text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
                Run inspection to surface empty fields, duplicates, invalid ranges, unexpected values, and basic logical inconsistencies.
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-[#EAEAEA] dark:border-[#2A2A2A] opacity-50"></div>

          {/* Step 3 */}
          <div className="flex gap-6 sm:gap-8 items-start">
            <div className="flex-shrink-0">
              <span className="text-5xl sm:text-6xl font-bold text-[#4F7CFF] opacity-30">03</span>
            </div>
            <div className="flex-1 pt-2">
              <h3 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
                Review clear, actionable findings
              </h3>
              <p className="text-base sm:text-lg text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
                See exactly where issues occur, why they matter, and what could be fixed, without digging through raw files.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Reassurance */}
        <div className="text-center mt-16 sm:mt-20">
          <p className="text-sm sm:text-base text-[#6B6B6B] dark:text-[#8B8B8B]">
            DatumInt focuses on inspection, not enforcement; you stay in control of how issues are handled.
          </p>
        </div>
      </div>
    </section>
  );
};
