import React, { createContext, useContext, useState, useEffect } from "react";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type?: "success" | "info" | "warning";
}

export type ThemeMode = "light" | "dark";

interface AppContextType {
  isDemoModalOpen: boolean;
  openDemoModal: (planName?: string) => void;
  closeDemoModal: () => void;
  selectedPlan: string;
  isVideoModalOpen: boolean;
  openVideoModal: () => void;
  closeVideoModal: () => void;
  isCommandMenuOpen: boolean;
  openCommandMenu: () => void;
  closeCommandMenu: () => void;
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (theme: ThemeMode) => void;
  toasts: ToastMessage[];
  addToast: (toast: Omit<ToastMessage, "id">) => void;
  removeToast: (id: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("Growth");
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Initialize theme from localStorage or system preference
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("nexora-theme");
      if (saved === "light" || saved === "dark") {
        return saved;
      }
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "light";
  });

  // Apply theme to <html> element and sync to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("nexora-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => {
      const next = prev === "light" ? "dark" : "light";
      addToast({
        title: next === "dark" ? "High-Contrast Dark Mode Enabled" : "Clean Light Mode Enabled",
        description: next === "dark" ? "Optimized for low-light operations" : "Default high-clarity workspace",
        type: "info",
      });
      return next;
    });
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  const openDemoModal = (planName?: string) => {
    if (planName) setSelectedPlan(planName);
    setIsDemoModalOpen(true);
  };

  const closeDemoModal = () => setIsDemoModalOpen(false);
  const openVideoModal = () => setIsVideoModalOpen(true);
  const closeVideoModal = () => setIsVideoModalOpen(false);
  const openCommandMenu = () => setIsCommandMenuOpen(true);
  const closeCommandMenu = () => setIsCommandMenuOpen(false);

  const addToast = ({
    title,
    description,
    type = "info",
  }: Omit<ToastMessage, "id">) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, title, description, type }]);
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Keyboard shortcut listener for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsCommandMenuOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setIsDemoModalOpen(false);
        setIsVideoModalOpen(false);
        setIsCommandMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <AppContext.Provider
      value={{
        isDemoModalOpen,
        openDemoModal,
        closeDemoModal,
        selectedPlan,
        isVideoModalOpen,
        openVideoModal,
        closeVideoModal,
        isCommandMenuOpen,
        openCommandMenu,
        closeCommandMenu,
        theme,
        toggleTheme,
        setTheme,
        toasts,
        addToast,
        removeToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
};
