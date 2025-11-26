import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full max-w-full rounded-md border border-input bg-background px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm ring-offset-background placeholder:text-muted-foreground placeholder:pt-1 placeholder:pl-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 overflow-x-auto break-words shadow-sm hover:shadow-md hover:border-primary/50 transition-all duration-200",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
