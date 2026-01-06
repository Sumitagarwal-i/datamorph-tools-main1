import { useState } from "react";
import { X, Copy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildSupportMailto } from "@/lib/support";

const SUPPORT_EMAIL = "hello@datumintapp.com";

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  topic?: string;
}

export const SupportModal = ({ isOpen, onClose, topic }: SupportModalProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(SUPPORT_EMAIL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenEmail = () => {
    window.location.href = buildSupportMailto({ topic });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-md w-full border border-[#EAEAEA] dark:border-[#2E2E2E]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#EAEAEA] dark:border-[#2E2E2E]">
          <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Need help or want to share feedback?
          </h2>
          <button
            onClick={onClose}
            className="text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Primary Action Button */}
          <Button
            onClick={handleOpenEmail}
            className="w-full bg-[#0066CC] hover:bg-[#0052A3] text-white"
          >
            Open email client
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#EAEAEA] dark:border-[#2E2E2E]"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-[#1A1A1A] text-[#666666] dark:text-[#999999]">
                Or reach us directly
              </span>
            </div>
          </div>

          {/* Fallback Email Display */}
          <div className="space-y-3">
            <p className="text-sm text-[#666666] dark:text-[#999999]">
              If your email client didn't open, no worries — you can still reach us directly:
            </p>

            {/* Copyable Email Block */}
            <div className="bg-[#F5F5F5] dark:bg-[#0F0F0F] rounded-lg p-3 flex items-center justify-between gap-2 border border-[#EAEAEA] dark:border-[#2E2E2E]">
              <span className="font-mono text-sm text-[#1A1A1A] dark:text-[#E8E8E8] break-all">
                {SUPPORT_EMAIL}
              </span>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 p-2 rounded hover:bg-[#E8E8E8] dark:hover:bg-[#2E2E2E] transition-colors text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8]"
                title={copied ? "Copied!" : "Copy email"}
              >
                {copied ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>

            {/* Reassurance Text */}
            <p className="text-xs text-[#999999] dark:text-[#666666]">
              You can email us directly — we read every message.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
