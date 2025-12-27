import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

type MainChoice = 'yes' | 'somewhat' | 'no' | null;

const useCases = [
  'Config file',
  'Data ingestion / ETL',
  'API response',
  'Debugging a bug',
  'Learning / exploration',
  'Other',
];

export default function FeedbackPopup({
  fileName,
  fileType,
  onClose,
}: {
  fileName?: string | null;
  fileType?: string | null;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const [main, setMain] = useState<MainChoice>(null);
  const [followUp, setFollowUp] = useState<string | null>(null);
  const [otherFollowUp, setOtherFollowUp] = useState('');
  const [freeText, setFreeText] = useState('');
  const [useCase, setUseCase] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Auto-hide after 15 seconds if user does nothing
  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 15000);
    return () => clearTimeout(t);
  }, [onClose]);

  if (!visible) return null;

  const followUpOptionsFor = (choice: MainChoice) => {
    if (choice === 'yes') return [
      'Error location / line numbers',
      'Error explanation',
      'Summary panel',
      'Highlighting in editor',
      'Other',
    ];
    if (choice === 'somewhat') return [
      'Too many false errors',
      'Not enough detail',
      'Wrong line numbers',
      'Hard to understand explanation',
      'Other',
    ];
    return [
      'Errors were incorrect',
      'I already know this from my editor',
      'File was too large / limited',
      'I expected deeper analysis',
      'Other',
    ];
  };

  const submit = async () => {
    setSubmitting(true);
    const payload = {
      event_type: 'analysis_feedback',
      timestamp: new Date().toISOString(),
      file_name: fileName || null,
      file_type: fileType || null,
      main_answer: main,
      follow_up: followUp === 'Other' ? otherFollowUp : followUp,
      free_text: freeText || null,
      use_case: useCase || null,
    } as any;

    try {
      // Insert into Supabase table `analytics_feedbacks`
      const { error } = await supabase.from('analytics_feedbacks').insert([payload]);
      if (error) {
        console.error('Failed to submit feedback', error);
      }
    } catch (err) {
      console.error('Failed to submit feedback', err);
    }

    setSubmitting(false);

    // Simple thank-you microcopy then close
    setVisible(false);
    onClose();
  };

  return (
    <div className="fixed left-1/2 transform -translate-x-1/2 bottom-6 z-50 w-[min(720px,95%)]">
      <div className="mx-auto bg-[#0F1113] border border-[#1C1F22] rounded-md shadow-lg text-sm text-[#D0D3D8] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Was this analysis useful?</div>
            <div className="text-xs text-[#7A7F86] mt-1">≤ 15 seconds to answer — quick, honest, developer-focused</div>
          </div>
          <button onClick={() => { setVisible(false); onClose(); }} className="p-1 rounded hover:bg-[#111214]">
            <X className="h-4 w-4 text-[#9CA0A6]" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button onClick={() => setMain('yes')} className={`px-3 py-2 rounded ${main==='yes'? 'bg-[#0B1220] border border-[#263043]':'bg-[#0b0c0d] hover:bg-[#0d1114]'}`}>✅ Yes, clearly helpful</button>
          <button onClick={() => setMain('somewhat')} className={`px-3 py-2 rounded ${main==='somewhat'? 'bg-[#0B1220] border border-[#263043]':'bg-[#0b0c0d] hover:bg-[#0d1114]'}`}>😐 Somewhat / partially</button>
          <button onClick={() => setMain('no')} className={`px-3 py-2 rounded ${main==='no'? 'bg-[#0B1220] border border-[#263043]':'bg-[#0b0c0d] hover:bg-[#0d1114]'}`}>❌ Not really</button>
        </div>

        {main && (
          <div className="mt-3">
            <div className="text-xs font-medium text-[#9CA0A6]">{main === 'yes' ? 'What helped the most?' : main === 'somewhat' ? 'What felt missing or unclear?' : 'Why not? (brutally honest is okay)'}</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {followUpOptionsFor(main).map(opt => (
                <button key={opt} onClick={() => setFollowUp(opt)} className={`px-2 py-1 rounded text-xs ${followUp===opt? 'bg-[#16324B]':'bg-[#0b0c0d] hover:bg-[#0d1114]'}`}>{opt}</button>
              ))}
            </div>
            {followUp === 'Other' && (
              <input value={otherFollowUp} onChange={e => setOtherFollowUp(e.target.value)} maxLength={100} placeholder="Other (brief)" className="mt-2 w-full bg-[#0B0C0D] border border-[#1C1F22] rounded px-2 py-1 text-sm" />
            )}
          </div>
        )}

        <div className="mt-3">
          <div className="text-xs font-medium text-[#9CA0A6]">Anything else you’d like to tell us? (optional)</div>
          <textarea value={freeText} onChange={e => setFreeText(e.target.value)} maxLength={300} placeholder="Short note (max 300 chars)" className="mt-2 w-full bg-[#0B0C0D] border border-[#1C1F22] rounded px-2 py-1 text-sm resize-none h-20" />
        </div>

        <div className="mt-3">
          <div className="text-xs font-medium text-[#9CA0A6]">What were you using this file for? (optional)</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {useCases.map(u => (
              <button key={u} onClick={() => setUseCase(u)} className={`px-2 py-1 rounded text-xs ${useCase===u? 'bg-[#16324B]':'bg-[#0b0c0d] hover:bg-[#0d1114]'}`}>{u}</button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-xs text-[#7A7F86]">Detective D is in early stages — your feedback directly shapes what we build next.</div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setVisible(false); onClose(); }} className="text-xs px-3 py-1 rounded bg-transparent border border-[#1C1F22]">Skip</button>
            <button onClick={submit} disabled={submitting || !main} className="text-xs px-3 py-1 rounded bg-primary text-primary-foreground disabled:opacity-50">Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
