import { useApp } from "../context/AppContext";
import { Button } from "./ui/button";

export function CallToAction() {
  const { openDemoDialog } = useApp();

  return (
    <section id="get-started" className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
      <div className="rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground">
        <h2 className="text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">Send your next invoice with Sorrel</h2>
        <p className="mx-auto mt-4 max-w-lg opacity-70">
          Setup takes about ten minutes. Bring a CSV from your current tool or start fresh.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            id="cta-book-demo"
            onClick={() => openDemoDialog()}
            className="h-11 rounded-full bg-primary-foreground px-6 text-primary hover:bg-primary-foreground/90"
          >
            Book a demo
          </Button>
          <Button
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            className="h-11 rounded-full border border-primary-foreground/25 bg-transparent px-6 text-primary-foreground hover:bg-primary-foreground/10"
          >
            See pricing
          </Button>
        </div>
      </div>
    </section>
  );
}
