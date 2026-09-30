import React, { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";
import { Search, Moon, Sun } from "lucide-react";

export const Navbar: React.FC = () => {
  const { openDemoModal, openCommandMenu, theme, toggleTheme } = useApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <header
      className={`sticky top-0 w-full z-40 transition-all duration-200 font-body ${
        scrolled
          ? "bg-background/85 backdrop-blur-md border-b border-border shadow-2xs"
          : "bg-transparent"
      }`}
    >
      <nav
        id="navbar"
        className="flex items-center justify-between px-6 md:px-12 lg:px-20 py-4.5"
      >
        {/* Left: Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="flex items-center gap-2 text-left cursor-pointer focus:outline-none"
        >
          <span className="text-xl font-semibold tracking-tight text-foreground">
            ✦ Nexora
          </span>
        </button>

        {/* Center / Right Links */}
        <div className="flex items-center gap-6 lg:gap-8">
          <div className="hidden md:flex items-center gap-7">
            <button
              onClick={() => scrollTo("features")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Features
            </button>
            <button
              onClick={() => scrollTo("workflow-simulator")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Simulator
            </button>
            <button
              onClick={() => scrollTo("integrations")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Integrations
            </button>
            <button
              onClick={() => scrollTo("pricing")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Pricing
            </button>
            <button
              onClick={() => scrollTo("faq")}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              FAQ
            </button>
          </div>

          {/* Search Trigger */}
          <button
            onClick={openCommandMenu}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border bg-secondary/60 hover:bg-secondary text-muted-foreground hover:text-foreground text-xs transition-colors cursor-pointer"
            title="Search commands (⌘K)"
          >
            <Search className="h-3 w-3" />
            <span className="text-[11px]">Search</span>
            <kbd className="text-[9px] bg-background border border-border/80 px-1 py-0.2 rounded font-mono ml-0.5">
              ⌘K
            </kbd>
          </button>

          {/* Theme Toggle Button */}
          <button
            id="theme-toggle-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to high-contrast dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to high-contrast dark mode"}
            className="h-8 w-8 rounded-full border border-border bg-secondary/60 hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer"
          >
            {theme === "dark" ? (
              <Sun className="h-3.5 w-3.5 text-amber-400 transition-transform rotate-0 hover:rotate-45" />
            ) : (
              <Moon className="h-3.5 w-3.5 text-foreground transition-transform rotate-0 hover:-rotate-12" />
            )}
          </button>

          {/* CTA button */}
          <Button
            id="nav-cta-button"
            onClick={() => openDemoModal("Growth")}
            className="rounded-full px-5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-none cursor-pointer"
          >
            Book a demo
          </Button>
        </div>
      </nav>
    </header>
  );
};
