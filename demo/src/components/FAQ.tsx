import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useApp } from "../context/AppContext";
import { Button } from "./ui/button";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

export const FAQ: React.FC = () => {
  const { openDemoModal } = useApp();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const faqs = [
    {
      q: "How does Nexora differ from traditional automation platforms (Zapier, Workato)?",
      a: "Traditional tools rely on brittle, static if-then logic: when an API schema changes or an invoice layout varies by 1 millimeter, workflows crash. Nexora deploys reasoning agents that understand organizational intent, self-heal API drifts, reconcile multi-rail edge cases, and enforce mathematical financial guardrails before touching ledgers.",
    },
    {
      q: "What prevents an autonomous agent from issuing an erroneous wire or invoice?",
      a: "Every workflow operates inside a deterministic policy sandbox. You define dual-key signoff thresholds (e.g. any disbursement > $10,000 or any transaction with high anomaly score requires one-click approval via team chat or mobile from a verified human controller). All operations generate an immutable cryptographic audit proof.",
    },
    {
      q: "Is our proprietary financial data or customer PII used to train models?",
      a: "Never. Nexora operates with enterprise Zero Data Retention (ZDR) agreements. Your data is processed in ephemeral, isolated memory environments and encrypted with customer-managed keys (AES-256 at rest, TLS 1.3 in transit). Every access is logged and exportable for your auditors.",
    },
    {
      q: "How long does implementation take?",
      a: "Most teams connect their primary banking rails (Harbor, Cardinal, Payflow) and ERP (Ledgerly, Northbook) within 15 minutes using native OAuth. Pre-built workflows (e.g. Nimbus monthly reconciliation, payroll sweeps) activate instantly. Custom multi-agent pipelines typically deploy within 48 to 72 hours.",
    },
    {
      q: "Can Nexora run entirely inside our own private cloud VPC?",
      a: "Yes. Enterprise tier customers can deploy Nexora agent containers directly into their own Kubernetes environments, ensuring zero external data egress beyond your chosen banking and internal APIs.",
    },
  ];

  return (
    <motion.section
      id="faq"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-secondary/15 border-t border-border"
    >
      <div className="max-w-4xl mx-auto space-y-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center max-w-xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            Frequently Asked Questions
          </div>
          <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
            Everything you need to know about <span className="italic">Nexora</span>.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Have questions before deploying autonomous agents? Here are the facts.
          </p>
        </motion.div>

        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.08 }}
          className="space-y-3"
        >
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            return (
              <motion.div
                key={faq.q}
                variants={staggerItemVariants}
                className="rounded-xl bg-background border border-border overflow-hidden transition-all shadow-2xs"
              >
                <button
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-5 text-left text-sm font-semibold text-foreground hover:bg-secondary/30 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 ml-4 ${
                      isOpen ? "rotate-180 text-accent" : ""
                    }`}
                  />
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <div className="px-5 pb-5 pt-1 text-xs text-muted-foreground leading-relaxed border-t border-border/40">
                        {faq.a}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="p-6 rounded-2xl bg-background border border-border text-center space-y-3 shadow-sm"
        >
          <h3 className="text-sm font-semibold text-foreground">
            Still have a specific architectural requirement?
          </h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Our systems engineering team is available for deep architectural reviews and custom threat modeling sessions.
          </p>
          <div className="pt-2">
            <Button
              onClick={() => openDemoModal("Custom Architecture")}
              className="rounded-full px-6 text-xs bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
            >
              Consult with a Systems Architect
            </Button>
          </div>
        </motion.div>
      </div>
    </motion.section>
  );
};
