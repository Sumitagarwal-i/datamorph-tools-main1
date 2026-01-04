import { useFadeIn } from "@/hooks/useFadeIn";
import { useParallax } from "@/hooks/useParallax";

export const WhoIsForSection = () => {
  const { ref: fadeRef, isVisible } = useFadeIn<HTMLElement>(0.1);
  const { ref: parallaxRef, offset } = useParallax<HTMLElement>(0.05);

  const columns = [
    {
      title: "Early-stage teams & solo builders",
      body: "You’re importing CSVs or JSON from external sources, vendors, or clients, and want a quick way to catch issues before they break your app or pipeline."
    },
    {
      title: "Developers debugging data issues",
      body: "You already know how to validate syntax, but need visibility into missing fields, type mismatches, duplicates, or suspicious values, without writing custom scripts each time."
    },
    {
      title: "Proof-of-concept and exploration workflows",
      body: "You’re exploring new datasets, schemas, or integrations and want fast feedback before committing to deeper automation or stricter contracts."
    }
  ];

  return (
    <section 
      ref={(node) => {
        fadeRef.current = node;
        parallaxRef.current = node;
      }}
      className={`w-full bg-white dark:bg-[#0F0F0F] py-16 sm:py-20 lg:py-24 transition-all duration-700 relative overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Parallax background accents */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          transform: `translateY(${offset * 0.10}px)`,
          background: "linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 60%, #F8F9FA 100%)",
        }}
      />
      <div
        className="absolute inset-0 -z-10 opacity-0 dark:opacity-100"
        style={{
          transform: `translateY(${offset * 0.10}px)`,
          background: "linear-gradient(180deg, #0F0F0F 0%, #0F0F0F 55%, #141414 100%)",
        }}
      />
      <div
        className="absolute -top-28 left-[-160px] h-[420px] w-[420px] rounded-full blur-3xl opacity-30 dark:opacity-14 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 60% 40%, rgba(79,124,255,0.16) 0%, rgba(79,124,255,0) 70%)",
        }}
      />
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Built for teams and individuals who deal with messy data inputs
          </h2>
          <p className="text-lg text-[#6B6B6B] dark:text-[#A8A8A8] max-w-3xl mx-auto">
            Especially when files look fine, but still cause issues later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {columns.map((col) => (
            <div
              key={col.title}
              className="rounded-xl border border-[#E4E7EC] dark:border-[#262626] bg-[#F9FAFB] dark:bg-[#1A1A1A] p-6 sm:p-8 shadow-sm"
            >
              <div className="h-1 w-12 bg-[#4F7CFF] rounded-full mb-5" aria-hidden />
              <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">{col.title}</h3>
              <p className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">{col.body}</p>
            </div>
          ))}
        </div>

        <div className="text-center mt-12 sm:mt-14">
          <p className="text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
            DatumInt is not a replacement for production pipelines; it’s an inspection layer before they break.
          </p>
        </div>
      </div>
    </section>
  );
};
