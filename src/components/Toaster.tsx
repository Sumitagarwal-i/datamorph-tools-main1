import React, { useContext } from "react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { ToastContext, ToastVariant } from "@/contexts/ToastContext";

const variantStyles: Record<ToastVariant, { bg: string; icon: React.ReactNode; textColor: string; borderColor: string }> = {
  success: {
    bg: "bg-[#181A1B]",
    borderColor: "border border-[#23262A]",
    icon: <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />,
    textColor: "text-[#E6E7E9]",
  },
  error: {
    bg: "bg-[#181A1B]",
    borderColor: "border border-[#23262A]",
    icon: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
    textColor: "text-[#E6E7E9]",
  },
  info: {
    bg: "bg-[#181A1B]",
    borderColor: "border border-[#23262A]",
    icon: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
    textColor: "text-[#E6E7E9]",
  },
};

export const Toaster: React.FC = () => {
  const context = useContext(ToastContext);

  if (!context) {
    return null;
  }

  const { toasts, removeToast } = context;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm">
      {toasts.map((toast) => {
        const styles = variantStyles[toast.variant];

        return (
          <div
            key={toast.id}
            className={`
              ${styles.bg}
              ${styles.borderColor}
              rounded-[12px]
              p-4
              shadow-lg
              w-[340px]
              flex
              items-start
              gap-3
              animate-fade-in-up
              ${styles.textColor}
            `}
          >
            {/* Icon */}
            <div className="mt-0.5">{styles.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">{toast.message}</p>
              {toast.description && (
                <p className="text-xs opacity-75 mt-1 leading-tight">{toast.description}</p>
              )}
            </div>

            {/* Close Button */}
            <button
              onClick={() => removeToast(toast.id)}
              className="flex-shrink-0 p-1 hover:bg-[#23262A] rounded transition-colors"
              aria-label="Close notification"
            >
              <X className="w-4 h-4 text-[#7A7F86] hover:text-[#D0D3D8]" />
            </button>
          </div>
        );
      })}

      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fadeInUp 0.3s ease-out;
        }

        /* Mobile responsive - adjust width and position */
        @media (max-width: 640px) {
          .fixed.bottom-6.right-6 {
            bottom: 24px;
            right: 16px;
            left: 16px;
            max-width: none;
          }

          .fixed.bottom-6.right-6 > div {
            width: 100% !important;
          }
        }
      `}</style>
    </div>
  );
};
