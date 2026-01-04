import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Loader2, CheckCircle2 } from "lucide-react";
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
    setErrorMessage(""); // Clear error when user types
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate email on submit
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
      const { data, error } = await supabase
        .from('notification_subscriptions')
        .insert([
          { 
            email: trimmedEmail,
            subscribed_at: new Date().toISOString()
          }
        ])
        .select();

      if (error) {
        // Check for duplicate email
        if (error.code === '23505') {
          setErrorMessage("This email is already subscribed");
        } else {
          throw error;
        }
      } else {
        setIsSuccess(true);
        toast.success("Successfully subscribed!", {
          description: "We'll notify you when Inspect launches.",
        });
        
        // Reset form after 2 seconds and close modal
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
    if (!isSubmitting) {
      setEmail("");
      setIsSuccess(false);
      setErrorMessage("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-[90vw] sm:max-w-md mx-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
            <Bell className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            Get Notified
          </DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Be the first to know when <span className="text-primary font-semibold">Inspect</span> launches.
            We'll send you an email notification.
          </DialogDescription>
        </DialogHeader>
        
        {!isSuccess ? (
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 pt-3 sm:pt-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium dark:text-foreground light:text-slate-900">
                Email Address
              </Label>
              <div className="relative">
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className={`dark:bg-background dark:text-foreground light:bg-white light:text-slate-900 ${
                    errorMessage 
                      ? 'border-red-500 focus-visible:ring-red-500 dark:border-red-500 light:border-red-600'
                      : 'dark:border-border light:border-slate-300'
                  }`}
                  disabled={isSubmitting}
                  autoFocus
                />
              </div>
              {errorMessage && (
                <p className="text-xs sm:text-sm text-red-500 dark:text-red-400 light:text-red-600">{errorMessage}</p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSubmitting}
                className="flex-1 order-2 sm:order-1 dark:border-border dark:text-foreground light:border-slate-300 light:text-slate-900"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!email.trim() || isSubmitting}
                className="flex-1 order-1 sm:order-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span className="text-sm sm:text-base">Subscribing...</span>
                  </>
                ) : (
                  <span className="text-sm sm:text-base">Subscribe</span>
                )}
              </Button>
            </div>
          </form>
        ) : (
          <div className="py-6 sm:py-8 text-center space-y-3 sm:space-y-4">
            <CheckCircle2 className="h-12 w-12 sm:h-16 sm:w-16 text-green-500 dark:text-green-500 light:text-green-600 mx-auto" />
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-1 dark:text-foreground light:text-slate-900">You're all set!</h3>
              <p className="text-xs sm:text-sm text-muted-foreground dark:text-muted-foreground light:text-slate-600">
                We'll notify you when Inspect is ready.
              </p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
