import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, Twitter } from "lucide-react";

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ContactModal = ({ open, onOpenChange }: ContactModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Contact Us</DialogTitle>
          <DialogDescription>
            Get in touch with us through any of these channels
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Mail className="h-5 w-5 text-primary" />
              <span>Email</span>
            </div>
            <div className="space-y-1 pl-7">
              <a
                href="mailto:linkmageqy@gmail.com"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                linkmageqy@gmail.com
              </a>
              <a
                href="mailto:sumitagar4@gmail.com"
                className="block text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                sumitagar4@gmail.com
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Twitter className="h-5 w-5 text-primary" />
              <span>Twitter</span>
            </div>
            <div className="pl-7">
              <a
                href="https://twitter.com/sumit_entr42"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                @sumit_entr42
              </a>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5 text-primary"
                fill="currentColor"
              >
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z" />
              </svg>
              <span>Reddit</span>
            </div>
            <div className="pl-7">
              <a
                href="https://reddit.com/user/PriorNervous1031"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                u/PriorNervous1031
              </a>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
