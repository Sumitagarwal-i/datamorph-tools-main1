import React, { createContext, useState, useCallback, useId } from "react";

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
  description?: string;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).substring(2, 11);
    const newToast: Toast = { ...toast, id };
    
    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss (except errors)
    const duration = toast.duration || (toast.variant === "error" ? null : 4000);
    if (duration) {
      setTimeout(() => {
        removeToast(id);
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return {
    success: (message: string, options?: { description?: string; duration?: number }) =>
      context.addToast({
        message,
        variant: "success",
        description: options?.description,
        duration: options?.duration ?? 4000,
      }),
    error: (message: string, options?: { description?: string; duration?: number }) =>
      context.addToast({
        message,
        variant: "error",
        description: options?.description,
        duration: options?.duration ?? null,
      }),
    info: (message: string, options?: { description?: string; duration?: number }) =>
      context.addToast({
        message,
        variant: "info",
        description: options?.description,
        duration: options?.duration ?? 4000,
      }),
  };
};
