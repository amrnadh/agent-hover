import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

export interface Toast {
  id: string;
  title: string;
  description?: string;
}

export type Theme = "light" | "dark";

interface AppContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDemoDialogOpen: boolean;
  openDemoDialog: (plan?: string) => void;
  closeDemoDialog: () => void;
  demoPlan: string;
  toasts: Toast[];
  showToast: (toast: Omit<Toast, "id">) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

const THEME_KEY = "sorrel-theme";

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const [isDemoDialogOpen, setDemoDialogOpen] = useState(false);
  const [demoPlan, setDemoPlan] = useState("Studio");
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  // Follows the system theme until the visitor picks one.
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}
  };

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (toast: Omit<Toast, "id">) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((current) => [...current, { ...toast, id }]);
      setTimeout(() => dismissToast(id), 4000);
    },
    [dismissToast],
  );

  return (
    <AppContext.Provider
      value={{
        theme,
        toggleTheme,
        isDemoDialogOpen,
        openDemoDialog: (plan) => {
          if (plan) setDemoPlan(plan);
          setDemoDialogOpen(true);
        },
        closeDemoDialog: () => setDemoDialogOpen(false),
        demoPlan,
        toasts,
        showToast,
        dismissToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within an AppProvider");
  return context;
}
