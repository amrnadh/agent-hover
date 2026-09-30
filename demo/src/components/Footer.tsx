import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";
import { ArrowRight, CheckCircle2, Shield, Heart } from "lucide-react";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

export const Footer: React.FC = () => {
  const { openDemoModal, addToast } = useApp();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubscribed(true);
    addToast({
      title: "Subscribed to Nexora Dispatch",
      description: "You'll receive quarterly architectural briefs and agent benchmarks.",
      type: "success",
    });
  };

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <footer className="w-full bg-background border-t border-border font-body text-foreground">
      {/* Pre-Footer CTA Banner */}
      <div className="py-16 px-6 md:px-12 lg:px-20 border-b border-border bg-secondary/30">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="max-w-4xl mx-auto text-center space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
            Join 1,800+ Modern Operations Teams
          </div>

          <h2 className="font-display text-4xl md:text-6xl tracking-tight text-foreground leading-[1.05]">
            Ready to deploy your first <span className="italic">autonomous</span> agent?
          </h2>

          <p className="text-sm md:text-base text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Eliminate reconciliation headaches and scale your operations without scaling linear headcount.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => openDemoModal("Enterprise Pilot")}
              className="rounded-full px-7 py-5 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 shadow-md cursor-pointer"
            >
              Book a Personalized Demo
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById("workflow-simulator");
                if (el) el.scrollIntoView({ behavior: "smooth" });
              }}
              className="rounded-full px-6 py-5 text-sm font-medium cursor-pointer"
            >
              Try Interactive Simulator
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Main Footer Links */}
      <motion.div
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "0px 0px -30px 0px" }}
        custom={{ stagger: 0.08 }}
        className="max-w-6xl mx-auto py-14 px-6 md:px-12 lg:px-20 grid grid-cols-1 md:grid-cols-5 gap-10"
      >
        {/* Brand column */}
        <motion.div variants={staggerItemVariants} className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold tracking-tight text-foreground">
              ✦ Nexora
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            The autonomous infrastructure layer for modern finance, engineering, and operations teams. Built with cryptographic guardrails and zero-tolerance precision.
          </p>

          {/* Newsletter Form */}
          <div className="pt-2">
            <span className="block text-[11px] font-semibold text-foreground mb-1.5">
              Subscribe to Engineering & Architecture Dispatch
            </span>
            {subscribed ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>Thank you for subscribing!</span>
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex items-center gap-1.5 max-w-xs">
                <input
                  type="email"
                  required
                  placeholder="engineer@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-lg bg-secondary/50 border border-border focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <Button
                  type="submit"
                  size="sm"
                  className="rounded-lg text-xs px-3 bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
                >
                  Join
                </Button>
              </form>
            )}
          </div>
        </motion.div>

        {/* Column: Product */}
        <motion.div variants={staggerItemVariants} className="space-y-3">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Product
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <button
                onClick={() => scrollTo("features")}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Agentic Workflows
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollTo("features")}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Dual-Key Guardrails
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollTo("workflow-simulator")}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Live Simulator
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollTo("integrations")}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                100+ Integrations
              </button>
            </li>
            <li>
              <button
                onClick={() => scrollTo("pricing")}
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Pricing Tiers
              </button>
            </li>
          </ul>
        </motion.div>

        {/* Column: Solutions */}
        <motion.div variants={staggerItemVariants} className="space-y-3">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Solutions
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <button
                onClick={() => openDemoModal("Fintech")}
                className="hover:text-foreground transition-colors cursor-pointer text-left"
              >
                Fintech & Neo-banks
              </button>
            </li>
            <li>
              <button
                onClick={() => openDemoModal("Cloud Ops")}
                className="hover:text-foreground transition-colors cursor-pointer text-left"
              >
                AWS Cloud Reconciliation
              </button>
            </li>
            <li>
              <button
                onClick={() => openDemoModal("Enterprise")}
                className="hover:text-foreground transition-colors cursor-pointer text-left"
              >
                Enterprise ERP Sync
              </button>
            </li>
            <li>
              <button
                onClick={() => openDemoModal("Treasury")}
                className="hover:text-foreground transition-colors cursor-pointer text-left"
              >
                Multi-Rail Treasury
              </button>
            </li>
          </ul>
        </motion.div>

        {/* Column: Trust & Legal */}
        <motion.div variants={staggerItemVariants} className="space-y-3">
          <div className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Trust & Security
          </div>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Shield className="h-3 w-3 text-emerald-600" />
              <span>SOC2 Type II Certified</span>
            </li>
            <li>
              <button
                onClick={() =>
                  addToast({
                    title: "Security Whitepaper",
                    description: "AES-256 encryption architecture bundle downloaded.",
                    type: "info",
                  })
                }
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Security Whitepaper
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  addToast({
                    title: "Privacy Terms",
                    description: "Zero Data Retention policy active.",
                    type: "info",
                  })
                }
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Privacy & Data Retention
              </button>
            </li>
            <li>
              <button
                onClick={() =>
                  addToast({
                    title: "Compliance Pack",
                    description: "GDPR & ISO 27001 statements loaded.",
                    type: "info",
                  })
                }
                className="hover:text-foreground transition-colors cursor-pointer"
              >
                Terms of Service
              </button>
            </li>
          </ul>
        </motion.div>
      </motion.div>

      {/* Bottom Bar */}
      <div className="border-t border-border py-6 px-6 md:px-12 lg:px-20 text-[11px] text-muted-foreground flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          © {new Date().getFullYear()} Nexora Systems Inc. All rights reserved.
        </div>

        {/* Live operational status pill */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-foreground font-medium">
            All Systems Operational (99.99%)
          </span>
        </div>
      </div>
    </footer>
  );
};
