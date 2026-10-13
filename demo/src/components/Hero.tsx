import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useApp } from "../context/AppContext";
import { ProductPreview } from "./ProductPreview";
import { Button } from "./ui/button";
import { Squiggle } from "./ui/Squiggle";

const rise = (delay: number) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, delay, ease: "easeOut" as const },
});

export function Hero() {
  const { openDemoDialog } = useApp();

  return (
    <section id="hero-section" className="relative -mt-16 overflow-hidden pt-16">
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(55%_60%_at_50%_0%,var(--brand-soft),transparent)]" />
      <div className="relative mx-auto max-w-6xl px-6 pt-16 text-center sm:pt-20">
        <motion.a
          id="hero-badge"
          href="#features"
          {...rise(0)}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1 text-[13px] text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        >
          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">New</span>
          Recurring invoices for retainers
          <ArrowRight className="size-3.5" />
        </motion.a>

        <motion.h1
          id="hero-headline"
          {...rise(0.05)}
          className="mx-auto mt-6 max-w-3xl text-[2.5rem] leading-[1.08] font-semibold tracking-[-0.035em] text-balance sm:text-6xl"
        >
          Invoicing that gets you paid{" "}
          <span className="relative whitespace-nowrap">
            on time
            <Squiggle />
          </span>
        </motion.h1>

        <motion.p
          id="hero-subheadline"
          {...rise(0.1)}
          className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-balance text-muted-foreground sm:text-lg"
        >
          Sorrel sends your invoices, follows up when they're late, and shows where your cash stands. Built for
          studios and agencies of 2 to 50 people.
        </motion.p>

        <motion.div id="hero-cta-group" {...rise(0.15)} className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button
            id="hero-primary-cta"
            onClick={() => openDemoDialog()}
            className="h-11 rounded-full px-6 text-sm font-medium"
          >
            Book a demo
          </Button>
          <Button
            id="hero-secondary-cta"
            variant="outline"
            onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            className="h-11 rounded-full px-6"
          >
            Start free trial
          </Button>
        </motion.div>
        <motion.p {...rise(0.2)} className="mt-4 text-[13px] text-muted-foreground">
          14-day trial · No card needed
        </motion.p>
      </div>

      <motion.div {...rise(0.25)} className="relative mx-auto mt-14 max-w-6xl px-4 sm:px-6">
        <ProductPreview />
      </motion.div>
    </section>
  );
}
