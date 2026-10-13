import { CircleCheck, X } from "lucide-react";
import { useApp } from "../context/AppContext";

export function Toaster() {
  const { toasts, dismissToast } = useApp();

  return (
    <div aria-live="polite" className="pointer-events-none fixed top-20 right-4 z-50 flex w-80 max-w-[calc(100%-2rem)] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className="pointer-events-auto flex gap-3 rounded-xl border border-border bg-card p-3.5 text-sm shadow-window"
        >
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-brand" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">{toast.title}</p>
            {toast.description && <p className="mt-0.5 text-muted-foreground">{toast.description}</p>}
          </div>
          <button onClick={() => dismissToast(toast.id)} aria-label="Dismiss" className="cursor-pointer text-muted-foreground hover:text-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
