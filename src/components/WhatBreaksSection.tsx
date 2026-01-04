import { AlertTriangle, Boxes, ShieldCheck } from "lucide-react";
import { useFadeIn } from "@/hooks/useFadeIn";
import { useParallax } from "@/hooks/useParallax";

export const WhatBreaksSection = () => {
  const { ref: fadeRef, isVisible } = useFadeIn<HTMLElement>(0.1);
  const { ref: parallaxRef, offset } = useParallax<HTMLElement>(0.05);

  return (
    <section
      ref={(node) => {
        fadeRef.current = node;
        parallaxRef.current = node;
      }}
      className={`w-full bg-white dark:bg-[#0F0F0F] py-16 sm:py-20 lg:py-28 transition-all duration-700 relative overflow-hidden ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
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
        className="absolute -top-24 right-[-180px] h-[420px] w-[420px] rounded-full blur-3xl opacity-18 dark:opacity-12 -z-10"
        style={{
          transform: `translateY(${offset * 0.18}px)`,
          background: "radial-gradient(circle at 30% 30%, rgba(79,124,255,0.16) 0%, rgba(79,124,255,0) 70%)",
        }}
      />
      <div className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Two-Part Area */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          {/* Left: Storytelling */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#4F7CFF]" />
              <span className="uppercase tracking-[0.18em]">Silent data failures</span>
            </div>

            <h2 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-medium text-[#1A1A1A] dark:text-[#E8E8E8] leading-[1.05]">
              Most data failures don&apos;t
              <br />
              come from syntax errors.
            </h2>

            <p className="mt-5 text-base sm:text-lg text-[#6B6B6B] dark:text-[#A8A8A8] leading-relaxed max-w-xl">
              They come from schema drift, inconsistent fields, invalid ranges, and subtle logical errors that pass basic checks, then quietly break pipelines, dashboards, and production logic later.
            </p>

            <p className="mt-4 text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
              DatumInt surfaces these issues before data reaches your pipeline.
            </p>
          </div>

          {/* Right: Product-like Visual */}
          <div className="lg:col-span-7">
            <div className="relative">
              {/* Accent glow */}
              <div
                className="absolute -inset-6 rounded-[28px] blur-2xl opacity-60 dark:opacity-40"
                style={{
                  background:
                    "radial-gradient(60% 60% at 60% 40%, rgba(79,124,255,0.25) 0%, rgba(79,124,255,0.00) 70%)",
                }}
              />

              {/* Floating inspection panel */}
              <div className="relative border border-[#EAEAEA] dark:border-[#262626] rounded-2xl bg-white dark:bg-[#0B0B0B] shadow-xl overflow-hidden transform rotate-2">
                {/* Top bar */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-[#EAEAEA] dark:border-[#1E1E1E]">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#EAEAEA] dark:bg-[#262626]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#EAEAEA] dark:bg-[#262626]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#EAEAEA] dark:bg-[#262626]" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
                      events_2026_01.json
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
                      <span className="h-2 w-2 rounded-full bg-green-400" />
                      Structure OK
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                      <span className="h-2 w-2 rounded-full bg-red-400" />
                      3 Issues
                    </span>
                  </div>
                </div>

                {/* Body */}
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_240px]">
                  {/* Code / data preview */}
                  <div className="p-4 sm:p-5 border-b sm:border-b-0 sm:border-r border-[#EAEAEA] dark:border-[#1E1E1E]">
                    <div className="text-[11px] sm:text-xs font-mono text-[#6B6B6B] dark:text-[#A8A8A8] leading-5">
                      <div className="flex gap-3">
                        <span className="w-6 text-right opacity-60">12</span>
                        <span>{"{ \"user_id\": 1042, \"plan\": \"pro\", \"amount\": 79 }"}</span>
                      </div>
                      <div className="flex gap-3">
                        <span className="w-6 text-right opacity-60">13</span>
                        <span>{"{ \"user_id\": 1043, \"plan\": \"pro\", \"amount\": 79 }"}</span>
                      </div>

                      <div className="flex gap-3 rounded-md border border-red-500/25 bg-red-500/5 px-2 py-1 my-2">
                        <span className="w-6 text-right opacity-60">14</span>
                        <span>
                          {"{ \"user_id\": \"1044\", \"plan\": \"pro\", \"amount\": 79 }"}
                        </span>
                      </div>

                      <div className="flex gap-3">
                        <span className="w-6 text-right opacity-60">15</span>
                        <span>{"{ \"user_id\": 1045, \"plan\": \"team\", \"amount\": 199 }"}</span>
                      </div>

                      <div className="flex gap-3 rounded-md border border-red-500/25 bg-red-500/5 px-2 py-1 mt-2">
                        <span className="w-6 text-right opacity-60">16</span>
                        <span>
                          {"{ \"user_id\": 1046, \"plan\": null, \"amount\": 199 }"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 flex items-center gap-2 text-xs text-[#6B6B6B] dark:text-[#8B8B8B]">
                      <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-[#EAEAEA] dark:border-[#262626]">
                        <span className="h-1.5 w-1.5 rounded-full bg-[#4F7CFF]" />
                        Highlighted rows contain silent failures
                      </span>
                    </div>
                  </div>

                  {/* Issues panel */}
                  <div className="p-4 sm:p-5">
                    <div className="text-xs font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
                      Findings
                    </div>
                    <div className="mt-3 space-y-3">
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <div className="text-xs font-medium text-red-400">Type mismatch</div>
                        <div className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A8A8A8]">
                          <span className="font-mono text-red-400">user_id</span> expected number, got string.
                        </div>
                      </div>
                      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <div className="text-xs font-medium text-red-400">Unexpected null</div>
                        <div className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A8A8A8]">
                          <span className="font-mono text-red-400">plan</span> breaks downstream assumptions.
                        </div>
                      </div>
                      <div className="rounded-lg border border-[#EAEAEA] dark:border-[#262626] bg-[#F8F9FA] dark:bg-[#141414] p-3">
                        <div className="text-xs font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">Structure drift</div>
                        <div className="mt-1 text-[11px] text-[#6B6B6B] dark:text-[#A8A8A8]">
                          New fields detected vs. baseline schema.
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 text-[11px] text-[#6B6B6B] dark:text-[#8B8B8B]">
                      Clear issues, before ingestion.
                    </div>
                  </div>
                </div>
              </div>

              {/* Secondary shadow card (depth) */}
              <div className="hidden sm:block absolute -z-10 right-6 top-10 w-[86%] h-[86%] rounded-2xl border border-[#EAEAEA] dark:border-[#262626] bg-white dark:bg-[#0B0B0B] opacity-60 transform rotate-[5deg]" />
            </div>
          </div>
        </div>

        {/* Feature Highlights (Premium Light Mode Cards) */}
        <div className="mt-14 sm:mt-16">
          <div className="flex flex-col md:flex-row md:justify-center md:items-stretch gap-8 lg:gap-12">
            {/* Card 1: Structure Drift */}
            <div className="relative w-full max-w-[380px] overflow-hidden rounded-[14px] bg-white border border-black/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]">
              <Boxes className="h-10 w-10 text-[#06B6D4]" />
              <div className="mt-4 text-[19px] font-semibold text-[#0F172A]">
                Structure drift
              </div>
              <div className="mt-2 text-sm text-[#64748B] leading-relaxed">
                Schemas and columns change quietly until assumptions break.
              </div>

              {/* Subtle integrated illustration */}
              <div className="pointer-events-none absolute -bottom-8 -right-10 opacity-25">
                <svg width="280" height="220" viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="36" y="56" width="110" height="72" rx="10" stroke="#D1D5DB" strokeWidth="2" />
                  <rect x="162" y="44" width="92" height="60" rx="10" stroke="#D1D5DB" strokeWidth="2" />
                  <rect x="148" y="118" width="104" height="70" rx="10" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M68 92H114" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M180 74H232" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M168 152H228" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M120 120C150 110 158 98 170 86" stroke="#06B6D4" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Card 2: Silent Issues */}
            <div className="relative w-full max-w-[380px] overflow-hidden rounded-[14px] bg-white border border-black/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]">
              <AlertTriangle className="h-10 w-10 text-[#F97316]" />
              <div className="mt-4 text-[19px] font-semibold text-[#0F172A]">
                Silent issues
              </div>
              <div className="mt-2 text-sm text-[#64748B] leading-relaxed">
                Invalid ranges, corrupt fields, and subtle mismatches passing basic checks.
              </div>

              {/* Subtle integrated illustration */}
              <div className="pointer-events-none absolute -bottom-10 -right-12 opacity-25">
                <svg width="300" height="240" viewBox="0 0 300 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect x="44" y="62" width="212" height="138" rx="12" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M44 96H256" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M44 128H256" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M44 160H256" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M104 62V200" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M164 62V200" stroke="#D1D5DB" strokeWidth="2" />
                  <rect x="108" y="132" width="52" height="24" rx="6" fill="#EF4444" fillOpacity="0.08" stroke="#EF4444" strokeOpacity="0.18" />
                  <rect x="170" y="100" width="74" height="24" rx="6" fill="#EF4444" fillOpacity="0.05" stroke="#EF4444" strokeOpacity="0.16" />
                  <path d="M122 144H148" stroke="#F97316" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
            </div>

            {/* Card 3: Downstream Safety */}
            <div className="relative w-full max-w-[380px] overflow-hidden rounded-[14px] bg-white border border-black/[0.06] shadow-[0_4px_12px_rgba(0,0,0,0.04)] p-7 transition-all duration-300 hover:shadow-[0_8px_20px_rgba(0,0,0,0.08)] hover:-translate-y-[3px]">
              <ShieldCheck className="h-10 w-10 text-[#10B981]" />
              <div className="mt-4 text-[19px] font-semibold text-[#0F172A]">
                Downstream safety
              </div>
              <div className="mt-2 text-sm text-[#64748B] leading-relaxed">
                Catch problems before pipelines, dashboards, or production get polluted.
              </div>

              {/* Subtle integrated illustration */}
              <div className="pointer-events-none absolute -bottom-10 -right-10 opacity-25">
                <svg width="300" height="230" viewBox="0 0 300 230" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M70 70H146" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M154 70H230" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M70 118H170" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M178 118H230" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <path d="M70 166H206" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" />
                  <circle cx="70" cy="70" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <circle cx="154" cy="70" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <circle cx="230" cy="70" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <circle cx="70" cy="118" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <circle cx="178" cy="118" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <circle cx="70" cy="166" r="10" stroke="#D1D5DB" strokeWidth="2" />
                  <path d="M226 67l3 3 7-9" stroke="#10B981" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M174 115l3 3 7-9" stroke="#10B981" strokeOpacity="0.55" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-12 text-center">
            <p className="text-sm text-[#6B6B6B] dark:text-[#8B8B8B]">
              The expensive part isn&apos;t the error, it&apos;s discovering it too late.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
