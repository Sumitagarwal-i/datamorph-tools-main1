import { useState } from 'react';
import { X, Copy, Mail, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileName: string;
  issueCount: number;
}

export const ShareModal = ({ open, onOpenChange, fileName, issueCount }: ShareModalProps) => {
  const [copied, setCopied] = useState(false);

  const shareText = `Inspect found ${issueCount} issue(s) in ${fileName}. Analyzed with DatumInt's deterministic data quality engine.`;
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(shareText);
    setCopied(true);
    toast.success('Share text copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleEmail = () => {
    const subject = `Inspect Analysis: ${fileName}`;
    const body = encodeURIComponent(`${shareText}\n\nAnalysis Details:\n${shareUrl}`);
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${body}`);
  };

  const handleTwitter = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=600,height=400');
  };

  const handleLinkedIn = () => {
    const linkedinUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(linkedinUrl, '_blank', 'width=600,height=400');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="mx-auto bg-[#1F2326] border border-[#2B2F33] rounded-md shadow-2xl text-sm text-[#D1D5DB] max-w-sm w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2B2F33]">
          <h2 className="text-lg font-semibold text-[#D1D5DB]">Share Analysis Results</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-[#94A3B8] hover:text-[#D1D5DB] transition-colors"
            aria-label="Close share modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-4">
          {/* Preview */}
          <div className="bg-[#26292C] border border-[#2B2F33] rounded p-3 text-xs text-[#9CA3AF] max-h-28 overflow-y-auto">
            {shareText}
          </div>

          {/* Share Buttons */}
          <div className="space-y-2">
            <button
              onClick={handleCopy}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#26292C] hover:bg-[#2B2F33] rounded text-[#D1D5DB] transition-colors"
            >
              <Copy className="h-4 w-4 text-[#C7CED6]" />
              <div className="text-left">
                <div className="text-sm font-medium">{copied ? 'Copied!' : 'Copy to Clipboard'}</div>
                <div className="text-xs text-[#9CA3AF]">Quick copy of analysis summary</div>
              </div>
            </button>

            <button
              onClick={handleEmail}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#26292C] hover:bg-[#2B2F33] rounded text-[#D1D5DB] transition-colors"
            >
              <Mail className="h-4 w-4 text-[#C7CED6]" />
              <div className="text-left">
                <div className="text-sm font-medium">Share via Email</div>
                <div className="text-xs text-[#9CA3AF]">Send to colleagues</div>
              </div>
            </button>

            <button
              onClick={handleTwitter}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#26292C] hover:bg-[#2B2F33] rounded text-[#D1D5DB] transition-colors"
            >
              <svg className="h-4 w-4 text-[#C7CED6]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M6.29 18.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0020 3.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 01.8 7.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 010 16.407a11.616 11.616 0 006.29 1.84" />
              </svg>
              <div className="text-left">
                <div className="text-sm font-medium">Share on X (Twitter)</div>
                <div className="text-xs text-[#9CA3AF]">Post to your feed</div>
              </div>
            </button>

            <button
              onClick={handleLinkedIn}
              className="w-full flex items-center gap-3 px-4 py-3 bg-[#26292C] hover:bg-[#2B2F33] rounded text-[#D1D5DB] transition-colors"
            >
              <svg className="h-4 w-4 text-[#C7CED6]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.338 16.338H13.67V12.16c0-.995-.017-2.292-1.194-2.292-1.195 0-1.38.932-1.38 1.891v4.579H8.265V9.359h2.559v1.017h.037c.356-.675 1.227-1.387 2.526-1.387 2.703 0 3.203 1.778 3.203 4.092v4.657zM5.337 7.433c-.603 0-1.08-.484-1.08-1.079 0-.595.477-1.083 1.08-1.083.602 0 1.079.488 1.079 1.083 0 .595-.477 1.079-1.079 1.079zm.671 8.905H4.667V9.359h1.338v6.979zM17.668 1H2.328C1.595 1 1 1.581 1 2.298v15.403C1 18.418 1.595 19 2.328 19h15.34c.734 0 1.332-.582 1.332-1.299V2.298C19 1.581 18.402 1 17.668 1z" />
              </svg>
              <div className="text-left">
                <div className="text-sm font-medium">Share on LinkedIn</div>
                <div className="text-xs text-[#9CA3AF]">Reach your network</div>
              </div>
            </button>
          </div>

          <div className="pt-3 border-t border-[#2B2F33] text-center text-xs text-[#9CA3AF]">
            <p>Powered by DatumInt • Inspect Analysis</p>
          </div>
        </div>
      </div>
    </div>
  );
};
