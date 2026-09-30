import React from "react";
import { useApp } from "../context/AppContext";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useApp();

  return (
    <div
      id="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
    >
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className="pointer-events-auto flex items-start gap-3 p-3.5 rounded-xl bg-background/95 backdrop-blur-md border border-border shadow-lg font-body"
          >
            {toast.type === "success" && (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
            )}
            {toast.type === "warning" && (
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            )}
            {toast.type === "info" && (
              <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
            )}

            <div className="flex-1 pr-2">
              <p className="text-xs font-semibold text-foreground leading-tight">
                {toast.title}
              </p>
              {toast.description && (
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-normal">
                  {toast.description}
                </p>
              )}
            </div>

            <button
              onClick={() => removeToast(toast.id)}
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              aria-label="Dismiss toast"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
