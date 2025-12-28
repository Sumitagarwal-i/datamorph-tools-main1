import React from 'react';
import { X } from 'lucide-react';
import { YouTubeEmbed } from './YouTubeEmbed';

interface DetectiveDExplainerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DetectiveDExplainerModal({ open, onOpenChange }: DetectiveDExplainerModalProps) {
  if (!open) return null;

  return (
    <div className="fixed bottom-0 left-0 w-full flex justify-center z-50">
      <div className="bg-[#181A1B] border border-[#23262A] rounded-t-xl shadow-lg w-full max-w-md mx-auto p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="font-semibold text-base text-[#E6E7E9]">Let's understand Detective D</div>
          <button
            onClick={() => onOpenChange(false)}
            className="text-xs text-[#7A7F86] px-2 py-1 hover:bg-[#23262A] rounded"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="mb-4 text-sm text-[#D0D3D8]">
          Watch this quick video to see how Detective D works and how it can help you find and fix data issues.
        </div>
        <div className="mt-3">
          <YouTubeEmbed videoId="OSBS0LnuYUQ" title="Detective D Explainer Video" />
        </div>
        <p className="text-[#7A7F86] text-xs text-center mt-3">
          You can learn more in the Help Center anytime by clicking the Help button.
        </p>

        {/* Footer */}
        <div className="flex gap-2 mt-4 justify-end">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded bg-blue-600 text-white font-semibold text-sm hover:bg-blue-700 transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
