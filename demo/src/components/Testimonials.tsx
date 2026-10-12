import React from "react";
import { motion } from "framer-motion";
import { Star, Quote } from "lucide-react";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

export const Testimonials: React.FC = () => {
  const testimonials = [
    {
      quote:
        "Nexora replaced what used to be a grueling 4-day monthly close process with a continuous, real-time reconciliation engine. We haven't had a single financial variance in 6 quarters.",
      name: "Marcus Vance",
      role: "VP of Finance & Operations",
      company: "Spendly Infrastructure",
      metric: "98% reduction in month-end close time",
      avatarBg: "bg-indigo-100 text-indigo-700",
      initials: "MV",
    },
    {
      quote:
        "The dual-key guardrails gave our risk committee the confidence to let AI handle multi-million dollar vendor disbursements. The cryptographic audit trail is pristine.",
      name: "Elena Rostova",
      role: "Chief Technology Officer",
      company: "Aether Capital",
      metric: "$32M automated monthly volume",
      avatarBg: "bg-emerald-100 text-emerald-700",
      initials: "ER",
    },
    {
      quote:
        "When our Nimbus billing schemas drifted after a major provider update, Nexora's self-healing agent caught it and dynamically patched the payload. Zero alerts in the middle of the night.",
      name: "Devon Chen",
      role: "Head of Infrastructure Engineering",
      company: "Trackline Scale",
      metric: "100% uptime through 4 API migrations",
      avatarBg: "bg-amber-100 text-amber-800",
      initials: "DC",
    },
  ];

  return (
    <motion.section
      id="testimonials"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-background"
    >
      <div className="max-w-6xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center max-w-xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            Customer Validation
          </div>
          <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
            Validated in production by teams managing <span className="italic">billions</span>.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Read how engineering and finance teams eliminate operational friction.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {testimonials.map((t) => (
            <motion.div
              key={t.name}
              variants={staggerItemVariants}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="p-6 rounded-2xl bg-secondary/30 border border-border flex flex-col justify-between gap-6 shadow-2xs hover:shadow-md transition-shadow"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex text-amber-500">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold bg-accent/10 text-accent px-2.5 py-0.5 rounded-full">
                    {t.metric}
                  </span>
                </div>

                <p className="text-xs text-foreground leading-relaxed italic">
                  "{t.quote}"
                </p>
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-border/70">
                <div
                  className={`h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${t.avatarBg}`}
                >
                  {t.initials}
                </div>
                <div>
                  <div className="text-xs font-semibold text-foreground">
                    {t.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {t.role} • <span className="font-medium text-foreground">{t.company}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.section>
  );
};
