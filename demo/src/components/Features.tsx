import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ShieldCheck,
  RefreshCw,
  Eye,
  ArrowRight,
  CheckCircle2,
  Lock,
  GitBranch,
  Terminal,
} from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";

export const Features: React.FC = () => {
  const { openDemoModal, addToast } = useApp();
  const [selectedFeature, setSelectedFeature] = useState(0);

  const featureTabs = [
    {
      id: "agentic",
      icon: Brain,
      title: "Agentic Orchestration",
      tagline: "Autonomous multi-step execution",
      description:
        "Nexora breaks complex organizational tasks into declarative sub-goals, invoking internal tools and external APIs with verified rollback safety.",
      highlights: [
        "Dynamic planning with recursive error-correction",
        "Deterministic sandboxing for all API state changes",
        "Native GPT-5 reasoning engine with prompt grounding",
      ],
      previewSnippet: `// Nexora Agent Runtime
const workflow = await nexora.plan({
  intent: "Reconcile Q3 AWS infrastructure invoice",
  guardrails: { maxVariance: "$50.00", requireSignoff: true },
  tools: [MercuryAPI, AWSBilling, StripeInvoicing]
});
await workflow.executeSafely(); // Verified 100%`,
    },
    {
      id: "guardrails",
      icon: ShieldCheck,
      title: "Dual-Key Guardrails",
      tagline: "Enterprise safety controls",
      description:
        "Define policy thresholds where agents require explicit dual-signoff before capital movement or database mutations occur.",
      highlights: [
        "Cryptographic proof generated for every ledger touch",
        "Configurable financial threshold triggers ($5k, $50k+)",
        "Slack & Microsoft Teams instant one-click approvals",
      ],
      previewSnippet: `[GUARDRAIL ENFORCED]
Operation: Move $15,000.00 to AWS Cloud Corp
Risk Score: 0.04 (Low)
Threshold Check: Exceeds $10,000 dual-key policy
Status: Awaiting sign-off from Chief Financial Officer
Token Signature: sha256:7f83b1657ff1...`,
    },
    {
      id: "selfhealing",
      icon: RefreshCw,
      title: "Autonomous Self-Healing",
      tagline: "Resilient against schema drifts",
      description:
        "When third-party vendor APIs modify schemas or experience transient rate-limits, Nexora agents automatically adapt query payloads without downtime.",
      highlights: [
        "Semantic payload remapping on unexpected 4xx errors",
        "Zero-configuration exponential backoff with jitter",
        "Automated pull-request generation for developer review",
      ],
      previewSnippet: `[ALERT RECOVERED]
API Drift: Stripe API v2026-03 deprecated 'customer_balance'
Agent Action: Remapped to 'customer.financial_account.balance'
Impact: 0 missed transactions across 1,420 customers
Pull Request created: #892 "Auto-patch Stripe SDK"`,
    },
    {
      id: "telemetry",
      icon: Eye,
      title: "Full Audit Telemetry",
      tagline: "Complete decision transparency",
      description:
        "Inspect every token, reasoning tree, API parameter, and timestamp. Export instant compliance bundles ready for Big 4 auditors.",
      highlights: [
        "Complete step-by-step decision replay",
        "SOC2 Type II, ISO 27001, and GDPR compliance ready",
        "Exportable PDF/JSON evidence trails",
      ],
      previewSnippet: `[AUDIT REPLAY: TX-90214]
02:27:10.012 -> Received webhook event (AWS Invoice Available)
02:27:10.144 -> Extracted statement balance ($5,200.00)
02:27:10.201 -> Cross-referenced Mercury Checking balance ($8.45M)
02:27:10.320 -> Verified PO-991 matched approved purchase order
02:27:10.450 -> Status: Scheduled for batch settlement`,
    },
  ];

  return (
    <motion.section
      id="features"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-background"
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            Core Architecture
          </div>
          <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
            Built for mission-critical operations where <span className="italic">precision</span> is non-negotiable.
          </h2>
          <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
            Traditional automation breaks when edge cases appear. Nexora combines reasoning agents with deterministic financial guardrails.
          </p>
        </motion.div>

        {/* Interactive Feature Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.55, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-1.5 rounded-2xl bg-secondary/40 border border-border"
        >
          {featureTabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isSelected = selectedFeature === idx;
            return (
              <button
                key={tab.id}
                onClick={() => setSelectedFeature(idx)}
                className={`p-3 rounded-xl flex items-center gap-2.5 text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? "bg-background border border-border shadow-xs text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                }`}
              >
                <div
                  className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                    isSelected
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-semibold truncate">
                    {tab.title}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {tab.tagline}
                  </div>
                </div>
              </button>
            );
          })}
        </motion.div>

        {/* Detailed Feature Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left: Content & Bullet points */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px 0px -50px 0px" }}
            transition={{ duration: 0.6, delay: 0.15, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="lg:col-span-6 space-y-5"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedFeature}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">
                    {featureTabs[selectedFeature].tagline}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    {featureTabs[selectedFeature].title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {featureTabs[selectedFeature].description}
                  </p>
                </div>

                <div className="space-y-2.5 pt-2">
                  {featureTabs[selectedFeature].highlights.map((item) => (
                    <div key={item} className="flex items-start gap-2.5 text-xs text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="pt-3 flex items-center gap-3">
              <Button
                onClick={() => openDemoModal(featureTabs[selectedFeature].title)}
                className="rounded-full px-5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                Schedule Technical Deep-Dive
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  addToast({
                    title: "Specification Copied",
                    description: `${featureTabs[selectedFeature].title} RFC added to clipboard.`,
                    type: "success",
                  })
                }
                className="rounded-full px-4 text-xs font-medium cursor-pointer"
              >
                Copy Spec
              </Button>
            </div>
          </motion.div>

          {/* Right: Live Interactive Code / Terminal Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "0px 0px -50px 0px" }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.21, 0.47, 0.32, 0.98] }}
            className="lg:col-span-6"
          >
            <div className="rounded-2xl border border-border/80 bg-zinc-950 text-zinc-200 overflow-hidden shadow-xl font-mono text-[11px]">
              {/* Window Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/90">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[10px] text-zinc-400 ml-2 font-sans">
                    nexora-agent-kernel v2.4
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/80 px-2 py-0.5 rounded-full">
                    ● Active Sandbox
                  </span>
                </div>
              </div>

              {/* Code / Logs View */}
              <div className="p-5 space-y-2 overflow-x-auto min-h-[220px]">
                <AnimatePresence mode="wait">
                  <motion.pre
                    key={selectedFeature}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-zinc-300 leading-relaxed font-mono whitespace-pre-wrap"
                  >
                    {featureTabs[selectedFeature].previewSnippet}
                  </motion.pre>
                </AnimatePresence>
              </div>

              {/* Status footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-zinc-800/80 bg-zinc-900/50 text-[10px] text-zinc-400 font-sans">
                <span>Verified with zero memory leak</span>
                <span className="text-accent font-mono">Response: 12ms</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  );
};
