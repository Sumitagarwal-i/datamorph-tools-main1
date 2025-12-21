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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-[#101113] border border-[#1C1F22] rounded-lg shadow-lg max-w-xl w-full max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#1C1F22] sticky top-0 bg-[#101113]">
          <h2 className="text-lg font-bold text-[#E6E7E9]">Let's understand Detective D</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#7A7F86] hover:text-[#D0D3D8] transition-colors"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          <p className="text-[#D0D3D8] text-sm">
            Watch this quick video to see how Detective D works and how it can help you find and fix data issues.
          </p>
          
          {/* Video Embed */}
          <div className="mt-3">
            <YouTubeEmbed videoId="OSBS0LnuYUQ" title="Detective D Explainer Video" />
          </div>

          <p className="text-[#7A7F86] text-xs text-center mt-3">
            You can learn more in the Help Center anytime by clicking the Help button.
          </p>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-[#1C1F22] flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 bg-primary text-primary-foreground hover:bg-primary/90 transition-colors rounded text-sm font-medium"
          >
            Got it!
          </button>
        </div>
      </div>
    </div>
  );
}
