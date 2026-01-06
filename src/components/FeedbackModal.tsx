import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/contexts/ToastContext";

interface FeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const FeedbackModal = ({ open, onOpenChange }: FeedbackModalProps) => {
  const toast = useToast();
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error("Please enter your feedback");
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from("feedback")
        .insert({
          message: message.trim(),
          email: email.trim() || null,
        });

      if (error) throw error;

      toast.success("Thank you for your feedback!");
      setMessage("");
      setEmail("");
      onOpenChange(false);
    } catch (error) {
      console.error("Error submitting feedback:", error);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-md w-full border border-[#EAEAEA] dark:border-[#2E2E2E]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#EAEAEA] dark:border-[#2E2E2E]">
          <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Share your feedback
          </h2>
          <button
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Message Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
              Your feedback
            </label>
            <Textarea
              placeholder="Tell us what you think..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={isSubmitting}
              className="min-h-[100px] bg-[#F5F5F5] dark:bg-[#0F0F0F] border border-[#EAEAEA] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder:text-[#999999] dark:placeholder:text-[#666666] resize-none"
            />
          </div>

          {/* Email Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
              Email (optional)
            </label>
            <Input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              className="bg-[#F5F5F5] dark:bg-[#0F0F0F] border border-[#EAEAEA] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder:text-[#999999] dark:placeholder:text-[#666666]"
            />
          </div>

          {/* Reassurance Text */}
          <p className="text-xs text-[#999999] dark:text-[#666666]">
            We read every piece of feedback — thank you for helping us improve.
          </p>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="flex-1 border-[#EAEAEA] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E8E8E8]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!message.trim() || isSubmitting}
              className="flex-1 bg-[#0066CC] hover:bg-[#0052A3] text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : (
                "Send Feedback"
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
