import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";
import { Logo } from "./ui/Logo";

const links = [
  { href: "#features", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "#customers", label: "Customers" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const { theme, toggleTheme, openDemoDialog } = useApp();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      id="site-header"
      className={cn(
        "sticky top-0 z-40 border-b transition-colors",
        scrolled ? "border-border bg-background/85 backdrop-blur-md" : "border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-8 px-6">
        <a href="#" aria-label="Sorrel home">
          <Logo />
        </a>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex" aria-label="Main">
          {links.map((link) => (
            <a key={link.href} href={link.href} className="transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex">
            Sign in
          </Button>
          <Button id="nav-book-demo" onClick={() => openDemoDialog()}>
            Book a demo
          </Button>
        </div>
      </div>
    </header>
  );
}
