import { FileCode, AlertCircle, Type, Copy, TrendingDown, GitBranch } from "lucide-react";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useParallax } from "@/hooks/useParallax";

export const FocusScopeSection = () => {
  const { ref: fadeRef, isVisible } = useFadeIn<HTMLElement>(0.1);
  const { ref: parallaxRef, offset } = useParallax<HTMLElement>(0.055);
  const features = [
    {
      icon: FileCode,
      title: "File Structure & Syntax",
      description: "Automatically surface structural issues in common data formats such as CSV and JSON, including malformed rows, inconsistent column counts, broken delimiters, and invalid JSON structures that can silently fail or partially load."
    },
    {
      icon: AlertCircle,
      title: "Missing or Empty Fields",
      description: "Highlight required fields that are missing, empty, or unexpectedly null. These issues often pass basic validation but later break joins, aggregations, or application logic."
    },
    {
      icon: Type,
      title: "Type Inconsistencies",
      description: "Detect common type mismatches, such as numbers stored as strings, invalid boolean values, or mixed data types within the same column, that can corrupt analytics or cause runtime errors downstream."
    },
    {
      icon: Copy,
      title: "Duplicate or Repeated Records",
      description: "Surface duplicate entries, repeated identifiers, or redundant rows that inflate metrics, skew reports, or introduce ambiguity in downstream processing."
    },
    {
      icon: TrendingDown,
      title: "Implausible Values",
      description: "Flag values that look structurally valid but contextually wrong, such as negative quantities, out-of-range numbers, placeholder values like \"N/A\" or \"TBD\", and other patterns that often indicate upstream issues."
    },
    {
      icon: GitBranch,
      title: "Basic Logical Inconsistencies",
      description: "Identify simple logical red flags within a file, such as start dates after end dates, totals that don’t match the sum of parts, and other internal inconsistencies that indicate data reliability problems."
    }
  ];

  const featureSpans = ["lg:col-span-2", "", "", "", "lg:col-span-2", ""];
  return (
    <section 
      ref={(node) => {
        fadeRef.current = node;
        parallaxRef.current = node;
      }}
      className={`w-full bg-[#F5F6F8] dark:bg-[#141414] py-16 sm:py-20 lg:py-28 transition-all duration-700 relative overflow-hidden ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Parallax background accents */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          transform: `translateY(${offset * 0.12}px)`,
          background: "linear-gradient(180deg, #FFFFFF 0%, #F5F6F8 70%, #F5F6F8 100%)",
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
        className="absolute -bottom-24 left-[-180px] h-[460px] w-[460px] rounded-full blur-3xl opacity-35 dark:opacity-15 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 60% 40%, rgba(79,124,255,0.18) 0%, rgba(79,124,255,0) 70%)",
        }}
      />
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] mb-4">
            Common issues DatumInt helps surface
          </h2>
          <p className="text-lg text-[#6B6B6B] dark:text-[#A8A8A8] max-w-3xl mx-auto">
            These are some of the most frequent data problems DatumInt highlights today, based on real-world files that look valid but still cause downstream issues.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 auto-rows-[1fr] gap-6 lg:gap-8">
          <div className="lg:col-span-2 lg:row-span-2 p-7 sm:p-9 rounded-2xl border border-[#D9E0F2] dark:border-[#2A2A2A] bg-gradient-to-br from-[#F8FAFF] via-white to-[#EDF2FF] dark:from-[#1A1A1A] dark:via-[#141414] dark:to-[#141414] shadow-sm hover:shadow-md transition-all duration-300">
            <p className="text-sm font-medium text-[#4F7CFF] uppercase tracking-[0.08em]">Beyond a fixed checklist</p>
            <h3 className="text-2xl sm:text-3xl font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mt-3 mb-3">Built for the messy reality of real data</h3>
            <p className="text-base text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
              DatumInt is not a rule engine or a rigid validator. It inspects files holistically to surface patterns that look acceptable on the surface but often break pipelines, dashboards, or downstream logic.
            </p>
            <p className="text-base text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed mt-4">
              Instead of enforcing strict contracts upfront, DatumInt focuses on catching what’s suspicious, inconsistent, or risky, especially in data coming from vendors, exports, or external systems.
            </p>
            <p className="text-base text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed mt-4">
              Inspections are additive and evolve as new patterns appear.
            </p>
          </div>

          {features.map((feature, index) => (
            <div
              key={feature.title}
              className={`group p-6 sm:p-8 rounded-xl border border-[#E4E7EC] dark:border-[#262626] bg-white dark:bg-[#1A1A1A] hover:border-[#4F7CFF] dark:hover:border-[#4F7CFF] transition-all duration-300 shadow-sm hover:shadow-md ${featureSpans[index]}`}
            >
              <div className="mb-4">
                <feature.icon className="h-8 w-8 text-[#4F7CFF]" />
              </div>
              <h3 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-3">
                {feature.title}
              </h3>
              <p className="text-sm text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom line */}
        <div className="text-center mt-12 sm:mt-16">
          <p className="text-sm sm:text-base text-[#6B6B6B] dark:text-[#8B8B8B]">
            DatumInt is built to surface issues early, before they silently propagate into pipelines, dashboards, or decisions.
          </p>
        </div>
      </div>
    </section>
  );
};
