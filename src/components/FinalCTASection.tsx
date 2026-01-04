import { useNavigate } from "react-router-dom";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useParallax } from "@/hooks/useParallax";

export const FinalCTASection = () => {
  const navigate = useNavigate();
  const { ref: fadeRef, isVisible } = useFadeIn<HTMLElement>(0.1);
  const { ref: parallaxRef, offset } = useParallax<HTMLElement>(0.06);

  return (
    <section 
      ref={(node) => {
        fadeRef.current = node;
        parallaxRef.current = node;
      }}
      className={`w-full bg-[#F5F6F8] dark:bg-[#141414] py-14 sm:py-16 lg:py-20 transition-all duration-700 relative overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Background cue (subtle, on-brand) */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          transform: `translateY(${offset * 0.12}px)`,
          background: "linear-gradient(180deg, #F8F9FA 0%, #F5F6F8 65%, #F5F6F8 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-0 dark:opacity-100"
        style={{
          transform: `translateY(${offset * 0.12}px)`,
          background: "linear-gradient(180deg, #141414 0%, #141414 60%, #0F0F0F 100%)",
        }}
      />
      <div
        className="absolute -top-20 right-[-120px] h-[360px] w-[360px] rounded-full blur-3xl opacity-60 dark:opacity-35 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 30% 30%, rgba(79,124,255,0.35) 0%, rgba(79,124,255,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-24 left-[-140px] h-[420px] w-[420px] rounded-full blur-3xl opacity-50 dark:opacity-25 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 60% 40%, rgba(79,124,255,0.22) 0%, rgba(79,124,255,0) 70%)",
        }}
      />

      <div className="container max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
          Inspect your file in seconds
        </h2>
        <p className="text-lg text-[#6B6B6B] dark:text-[#A8A8A8] mb-8 sm:mb-10 max-w-2xl mx-auto">
          A calm, single step to see what breaks before it spreads.
        </p>
        <button
          onClick={() => navigate("/inspect")}
          className="inline-flex items-center justify-center rounded-full bg-[#4F7CFF] text-white px-7 sm:px-9 py-3 sm:py-3.5 text-base sm:text-lg font-semibold shadow-sm hover:bg-[#3F6AE0] active:bg-[#3559C7] transition-colors duration-200"
        >
          Open Inspector
        </button>
      </div>
    </section>
  );
};
