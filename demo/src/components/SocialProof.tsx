import React from "react";
import { motion } from "framer-motion";
import { Shield, Zap, TrendingUp, CheckCircle2 } from "lucide-react";
import {
  scrollFadeUpVariants,
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

export const SocialProof: React.FC = () => {
  const logos = [
    { name: "Harbor", mark: "HARBOR" },
    { name: "Spendly", mark: "SPENDLY" },
    { name: "Trackline", mark: "TRACKLINE" },
    { name: "Skyline", mark: "◆ SKYLINE" },
    { name: "Basewell", mark: "BASEWELL" },
    { name: "Toolhouse", mark: "TOOLHOUSE" },
    { name: "Cardinal", mark: "CARDINAL" },
    { name: "Payflow", mark: "PAYFLOW" },
  ];

  const metrics = [
    {
      value: "4.2M+",
      label: "Autonomous workflows run",
      icon: Zap,
    },
    {
      value: "$940M+",
      label: "Capital safely reconciled",
      icon: TrendingUp,
    },
    {
      value: "99.98%",
      label: "Execution accuracy rate",
      icon: CheckCircle2,
    },
    {
      value: "< 250ms",
      label: "Median agent response latency",
      icon: Shield,
    },
  ];

  return (
    <motion.section
      id="social-proof"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-14 px-6 md:px-12 lg:px-20 border-y border-border/80 bg-secondary/20 font-body"
    >
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ duration: 0.5, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center space-y-1.5"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Teams that run their back office on Nexora
          </p>
        </motion.div>

        {/* Logos Grid */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.05 }}
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4 items-center"
        >
          {logos.map((logo) => (
            <motion.div
              key={logo.name}
              variants={staggerItemVariants}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              className="flex items-center justify-center p-3 rounded-xl bg-background border border-border/70 text-muted-foreground hover:text-foreground hover:border-border transition-colors shadow-2xs font-semibold text-xs tracking-wider"
            >
              {logo.mark}
            </motion.div>
          ))}
        </motion.div>

        {/* Live Metrics Grid */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.08 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4"
        >
          {metrics.map((m) => {
            const Icon = m.icon;
            return (
              <motion.div
                key={m.label}
                variants={staggerItemVariants}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="p-4 rounded-xl bg-background border border-border shadow-2xs flex items-center gap-3.5 hover:shadow-sm transition-shadow"
              >
                <div className="h-9 w-9 rounded-lg bg-accent/10 text-accent flex items-center justify-center shrink-0">
                  <Icon className="h-4.5 w-4.5" />
                </div>
                <div>
                  <div className="text-xl font-bold tracking-tight text-foreground">
                    {m.value}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-tight">
                    {m.label}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.section>
  );
};
