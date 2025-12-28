import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FEEDBACK_OPTIONS = [
  { value: "yes", label: "✅ Yes, clearly helpful" },
  { value: "somewhat", label: "😐 Somewhat / partially" },
  { value: "no", label: "❌ Not really" },
];

const FOLLOWUPS = {
  yes: [
    "Error location / line numbers",
    "Error explanation",
    "Summary panel",
    "Highlighting in editor",
    "Other",
  ],
  somewhat: [
    "Too many false errors",
    "Not enough detail",
    "Wrong line numbers",
    "Hard to understand explanation",
    "Other",
  ],
  no: [
    "Errors were incorrect",
    "I already know this from my editor",
    "File was too large / limited",
    "I expected deeper analysis",
    "Other",
  ],
};

const USE_CASES = [
  "Config file",
  "Data ingestion / ETL",
  "API response",
  "Debugging a bug",
  "Learning / exploration",
  "Other",
];

export function FeedbackPopup({ fileName, fileType, onClose }: { fileName?: string; fileType?: string; onClose: () => void }) {
  const [step, setStep] = useState<"main" | "followup" | "done">("main");
  const [primary, setPrimary] = useState<string>("");
  const [followup, setFollowup] = useState<string>("");
  const [otherText, setOtherText] = useState<string>("");
  const [freeText, setFreeText] = useState<string>("");
  const [useCase, setUseCase] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const handlePrimary = (val: string) => {
    setPrimary(val);
    setStep("followup");
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      const { error } = await supabase.from("analytics_feedbacks").insert([
        {
          file_name: fileName || null,
          main_answer: primary,
          follow_up: followup === "Other" ? otherText : followup,
          free_text: freeText,
          use_case: useCase,
        },
      ]);
      if (error) {
        setError("Failed to submit feedback. Please try again.");
        setSubmitting(false);
        return;
      }
      setStep("done");
    } catch (e) {
      setError("Failed to submit feedback. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 w-full flex justify-center z-50">
      <div className="bg-[#181A1B] border border-[#23262A] rounded-t-xl shadow-lg w-full max-w-md mx-auto p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-base text-[#E6E7E9]">Help improve Detective D</div>
          <button className="text-xs text-[#7A7F86] px-2 py-1 hover:bg-[#23262A] rounded" onClick={onClose}>Skip</button>
        </div>
        {step === "main" && (
          <>
            <div className="mb-4 text-sm text-[#D0D3D8]">Did Detective D help you understand your file better?</div>
            <div className="flex flex-col gap-2 mb-4">
              {FEEDBACK_OPTIONS.map(opt => (
                <button key={opt.value} className={`px-3 py-2 rounded border border-[#23262A] text-left text-sm font-medium bg-[#202225] hover:bg-[#23262A] transition-colors ${primary === opt.value ? "border-blue-500" : ""}`} onClick={() => handlePrimary(opt.value)}>{opt.label}</button>
              ))}
            </div>
            <div className="text-xs text-[#7A7F86] mb-2">Quick feedback (≤ 15 seconds)</div>
          </>
        )}
        {step === "followup" && (
          <>
            <div className="mb-3 text-sm text-[#D0D3D8]">
              {primary === "yes" && "What helped the most?"}
              {primary === "somewhat" && "What felt missing or unclear?"}
              {primary === "no" && "Why not? (brutally honest is okay)"}
            </div>
            <div className="flex flex-col gap-2 mb-3">
              {FOLLOWUPS[primary].map(opt => (
                <button key={opt} className={`px-3 py-2 rounded border border-[#23262A] text-left text-sm font-medium bg-[#202225] hover:bg-[#23262A] transition-colors ${followup === opt ? "border-blue-500" : ""}`} onClick={() => setFollowup(opt)}>{opt}</button>
              ))}
            </div>
            {followup === "Other" && (
              <textarea className="w-full p-2 rounded border border-[#23262A] bg-[#202225] text-sm text-[#D0D3D8] mb-2" maxLength={120} placeholder="Other (please specify)" value={otherText} onChange={e => setOtherText(e.target.value)} />
            )}
            <div className="mb-2">
              <label className="block text-xs text-[#7A7F86] mb-1">Anything else you’d like to tell us? (optional)</label>
              <textarea className="w-full p-2 rounded border border-[#23262A] bg-[#202225] text-sm text-[#D0D3D8]" maxLength={300} value={freeText} onChange={e => setFreeText(e.target.value)} />
            </div>
            <div className="mb-2">
              <label className="block text-xs text-[#7A7F86] mb-1">What were you using this file for?</label>
              <div className="flex flex-wrap gap-2">
                {USE_CASES.map(opt => (
                  <button key={opt} className={`px-2 py-1 rounded border border-[#23262A] text-xs font-medium bg-[#202225] hover:bg-[#23262A] transition-colors ${useCase === opt ? "border-blue-500" : ""}`} onClick={() => setUseCase(opt)}>{opt}</button>
                ))}
              </div>
            </div>
            {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
            <div className="flex gap-2 mt-2">
              <button className="px-4 py-2 rounded bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors" disabled={submitting} onClick={handleSubmit}>Submit</button>
              <button className="px-4 py-2 rounded bg-[#23262A] text-[#7A7F86] font-semibold text-sm hover:bg-[#23262A]/80 transition-colors" onClick={onClose}>Close</button>
            </div>
            <div className="text-xs text-[#7A7F86] mt-3">Detective D is in early stages — your feedback directly shapes what we build next.</div>
          </>
        )}
        {step === "done" && (
          <div className="text-center py-8">
            <div className="text-lg font-semibold text-green-400 mb-2">Thank you for your feedback!</div>
            <button className="mt-4 px-4 py-2 rounded bg-[#23262A] text-[#7A7F86] font-semibold text-sm hover:bg-[#23262A]/80 transition-colors" onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
}
