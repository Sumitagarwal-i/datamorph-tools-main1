import { useState } from "react";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface NotificationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationModal({ open, onOpenChange }: NotificationModalProps) {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    setErrorMessage("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedEmail = email.toLowerCase().trim();
    const isValidEmail = emailRegex.test(trimmedEmail);
    
    if (!isValidEmail) {
      setErrorMessage("Please enter a valid email address");
      return;
    }
    
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const { error } = await supabase
        .from('notification_subscriptions')
        .insert([
          { 
            email: trimmedEmail,
            subscribed_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        if (error.code === '23505') {
          setErrorMessage("This email is already subscribed");
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
        toast.success("Successfully subscribed!", {
          description: "We'll notify you about new updates.",
        });
        
        setTimeout(() => {
          setEmail("");
          setIsSuccess(false);
          onOpenChange(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error subscribing:', error);
      setErrorMessage("Failed to subscribe. Please try again.");
      toast.error("Subscription failed", {
        description: "Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting && !isSuccess) {
      setEmail("");
      setErrorMessage("");
      onOpenChange(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-lg shadow-xl max-w-md w-full border border-[#EAEAEA] dark:border-[#2E2E2E]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[#EAEAEA] dark:border-[#2E2E2E]">
          <h2 className="text-lg font-semibold text-[#1A1A1A] dark:text-[#E8E8E8]">
            Stay connected
          </h2>
          <button
            onClick={handleClose}
            disabled={isSubmitting || isSuccess}
            className="text-[#666666] dark:text-[#999999] hover:text-[#1A1A1A] dark:hover:text-[#E8E8E8] transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {!isSuccess ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Description */}
              <p className="text-sm text-[#666666] dark:text-[#999999]">
                Be the first to know about new features, updates, and tips for using DatumInt.
              </p>

              {/* Email Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[#1A1A1A] dark:text-[#E8E8E8]">
                  Email address
                </label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={handleEmailChange}
                  disabled={isSubmitting}
                  className={`bg-[#F5F5F5] dark:bg-[#0F0F0F] text-[#1A1A1A] dark:text-[#E8E8E8] placeholder:text-[#999999] dark:placeholder:text-[#666666] ${
                    errorMessage 
                      ? "border-red-500 dark:border-red-500" 
                      : "border-[#EAEAEA] dark:border-[#2E2E2E]"
                  }`}
                  autoFocus
                />
                {errorMessage && (
                  <p className="text-xs text-red-500 dark:text-red-400">{errorMessage}</p>
                )}
              </div>

              {/* Reassurance Text */}
              <p className="text-xs text-[#999999] dark:text-[#666666]">
                We respect your inbox — unsubscribe anytime.
              </p>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="flex-1 border-[#EAEAEA] dark:border-[#2E2E2E] text-[#1A1A1A] dark:text-[#E8E8E8]"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!email.trim() || isSubmitting}
                  className="flex-1 bg-[#0066CC] hover:bg-[#0052A3] text-white"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Subscribing...
                    </>
                  ) : (
                    "Subscribe"
                  )}
                </Button>
              </div>
            </form>
          ) : (
            /* Success State */
            <div className="py-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-500 mx-auto" />
              <div>
                <h3 className="text-base font-semibold text-[#1A1A1A] dark:text-[#E8E8E8] mb-1">
                  You're all set!
                </h3>
                <p className="text-sm text-[#666666] dark:text-[#999999]">
                  We'll keep you updated on what's new.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
