import { useTheme } from "next-themes";
import { Toaster as Sonner, toast as sonnerToast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Force dark-style notifications for better contrast in app theme
  // We still respect other Sonner props passed in via {...props}
  const enforcedTheme: ToasterProps["theme"] = "dark";

  return (
    <>
      <style>{`
        /* Force Sonner's close button to the absolute top-right corner */
        [data-sonner-toast] [data-close-button] {
          position: absolute !important;
          right: 0 !important;
          top: 0 !important;
          margin: 0 !important;
          transform: none !important;
          width: 32px !important;
          height: 32px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          border-radius: 9999px !important;
          background: transparent !important;
          color: rgb(203, 213, 225) !important;
          border: none !important;
          cursor: pointer !important;
          padding: 0 !important;
          box-shadow: none !important;
          z-index: 2 !important;
          transition: color 0.2s !important;
        }
        /* Add comfortable padding, rounded corners and spacing for toast body */
        [data-sonner-toast] {
          padding: 12px 56px 12px 16px !important;
          border-radius: 8px !important;
          gap: 12px !important;
          display: flex !important;
          align-items: flex-start !important;
          min-width: 280px !important;
        }
        [data-sonner-toast] [data-close-button]:hover {
          color: white !important;
          background: transparent !important;
        }
        [data-sonner-toast] [data-close-button]:focus {
          outline: none !important;
        }
      `}</style>
      <Sonner
        theme={enforcedTheme}
        className="toaster group"
        closeButton
        toastOptions={{
          classNames: {
            // Explicit dark background and high-contrast text to avoid white notifications
            toast:
              "group toast bg-slate-900 text-white border-transparent shadow-lg px-4 py-3 gap-3 items-start",
            description: "text-slate-200 mt-0 leading-snug",
            // Small circular dismiss button on the right - no background
            actionButton: "ml-3 h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-slate-300 hover:text-white transition-colors",
            cancelButton: "ml-3 h-8 w-8 shrink-0 flex items-center justify-center rounded-full text-slate-300 hover:text-white transition-colors",
            closeButton: "",
          },
        }}
        {...props}
      />
    </>
  );
};

// Wrap Sonner's toast to provide proper API while using native close button
const toast = {
  success: (message: string, options?: any) =>
    sonnerToast.success(message, options),
  error: (message: string, options?: any) =>
    sonnerToast.error(message, options),
  warning: (message: string, options?: any) =>
    sonnerToast.warning(message, options),
  info: (message: string, options?: any) =>
    sonnerToast(message, options),
  // Generic call
  plain: (message: string, options?: any) =>
    sonnerToast(message, options),
  // re-export dismiss for direct control
  dismiss: (id?: string) => sonnerToast.dismiss(id),
} as any;

export { Toaster, toast };
