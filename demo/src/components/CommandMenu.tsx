import React, { useState } from "react";
import { useApp } from "../context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  X,
  Zap,
  Calendar,
  Layers,
  ArrowRight,
  ShieldCheck,
  CreditCard,
  FileText,
  Play,
  Moon,
  Sun,
} from "lucide-react";

export const CommandMenu: React.FC = () => {
  const {
    isCommandMenuOpen,
    closeCommandMenu,
    openDemoModal,
    openVideoModal,
    addToast,
    theme,
    toggleTheme,
  } = useApp();
  const [query, setQuery] = useState("");

  const actions = [
    {
      icon: theme === "dark" ? Sun : Moon,
      title: theme === "dark" ? "Switch to Clean Light Theme" : "Switch to High-Contrast Dark Theme",
      description: "Toggle app appearance with localStorage persistence",
      action: () => {
        closeCommandMenu();
        toggleTheme();
      },
    },
    {
      icon: Calendar,
      title: "Schedule Architecture Demo",
      description: "Pick a 20-min session with our engineers",
      action: () => {
        closeCommandMenu();
        openDemoModal("Growth");
      },
    },
    {
      icon: Play,
      title: "Watch Product Video Walkthrough",
      description: "See autonomous agent execution in 4K",
      action: () => {
        closeCommandMenu();
        openVideoModal();
      },
    },
    {
      icon: Zap,
      title: "Test Live Workflow Simulator",
      description: "Simulate real-time reconciliation",
      action: () => {
        closeCommandMenu();
        const el = document.getElementById("workflow-simulator");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      icon: Layers,
      title: "Browse Integrations Ecosystem",
      description: "Harbor, Nimbus, Payflow, Trackline, Ledgerly",
      action: () => {
        closeCommandMenu();
        const el = document.getElementById("integrations");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      icon: CreditCard,
      title: "View Pricing Tiers & ROI Calculator",
      description: "Starter, Growth, and Enterprise plans",
      action: () => {
        closeCommandMenu();
        const el = document.getElementById("pricing");
        if (el) el.scrollIntoView({ behavior: "smooth" });
      },
    },
    {
      icon: ShieldCheck,
      title: "Export Security Overview",
      description: "Download encryption and compliance audit",
      action: () => {
        closeCommandMenu();
        addToast({
          title: "Security Whitepaper generated",
          description: "Security overview downloaded.",
          type: "success",
        });
      },
    },
  ];

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.description.toLowerCase().includes(query.toLowerCase())
  );

  if (!isCommandMenuOpen) return null;

  return (
    <AnimatePresence>
      <div
        id="command-palette-backdrop"
        className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-foreground/50 backdrop-blur-sm"
        onClick={closeCommandMenu}
      >
        <motion.div
          id="command-palette-card"
          initial={{ opacity: 0, scale: 0.96, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -10 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg rounded-2xl bg-background border border-border shadow-2xl overflow-hidden font-body text-foreground"
        >
          {/* Search Header */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-secondary/30">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="text"
              placeholder="Type a command or jump to section..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* List */}
          <div className="max-h-72 overflow-y-auto p-2 space-y-1">
            {filtered.length > 0 ? (
              filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
                    onClick={item.action}
                    className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-secondary/70 transition-colors text-left group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-7 w-7 rounded-lg bg-secondary text-foreground flex items-center justify-center shrink-0 group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-medium text-foreground">
                          {item.title}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {item.description}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No matching commands found.
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
