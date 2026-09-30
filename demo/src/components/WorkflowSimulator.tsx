import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Cpu,
  ArrowRight,
  Sparkles,
  ShieldAlert,
  Layers,
  Calculator,
  TrendingUp,
} from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";
import { ROICalculator } from "./ROICalculator";

export const WorkflowSimulator: React.FC = () => {
  const { addToast, openDemoModal } = useApp();
  const [activeTab, setActiveTab] = useState<"sandbox" | "roi">("roi");
  const [selectedPrompt, setSelectedPrompt] = useState(
    "Reconcile $5,200 AWS variance against Mercury Treasury balance"
  );
  const [isRunning, setIsRunning] = useState(false);
  const [step, setStep] = useState<number>(0);
  const [completed, setCompleted] = useState(false);

  const predefinedPrompts = [
    "Reconcile $5,200 AWS variance against Mercury Treasury balance",
    "Audit Ramp cards for duplicate SaaS renewals over $1,000",
    "Generate Net-30 enterprise invoice from closed Salesforce deal",
  ];

  const executionSteps = [
    {
      title: "1. Intent Parsing & Policy Guardrails",
      detail:
        "Agent parses natural language entities, validates financial threshold ($5.2k < $10k dual-signoff limit), and confirms read/write API privileges.",
    },
    {
      title: "2. Real-time Multi-Rail Verification",
      detail:
        "Agent queries AWS CloudWatch Billing API, matches PO-991 in ERP ledger, and verifies available liquidity across Mercury checking accounts.",
    },
    {
      title: "3. Cryptographic Settlement & Audit Receipt",
      detail:
        "Dual-entry ledger line generated, cryptographic SHA-256 hash created, and confirmation notification pushed to Slack finance channel.",
    },
  ];

  const handleRunSimulation = () => {
    if (isRunning) return;
    setIsRunning(true);
    setCompleted(false);
    setStep(1);

    setTimeout(() => {
      setStep(2);
      setTimeout(() => {
        setStep(3);
        setTimeout(() => {
          setIsRunning(false);
          setCompleted(true);
          addToast({
            title: "Workflow Successfully Executed!",
            description: "Proof hash generated: sha256:d8a2...3f1",
            type: "success",
          });
        }, 1200);
      }, 1200);
    }, 1000);
  };

  const handleReset = () => {
    setIsRunning(false);
    setStep(0);
    setCompleted(false);
  };

  return (
    <motion.section
      id="workflow-simulator"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-secondary/15 border-t border-border"
    >
      <div className="max-w-5xl mx-auto space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center max-w-2xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            <Sparkles className="h-3 w-3" />
            Interactive Agent Engine & ROI Modeling
          </div>
          <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
            See the autonomous agent in <span className="italic">action</span>.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Test how Nexora converts complex operational instructions into deterministic transactions, or calculate exact hours and capital recovered for your team.
          </p>
        </motion.div>

        {/* Simulator Box */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="rounded-2xl bg-background border border-border shadow-xl p-6 md:p-8 space-y-6"
        >
          {/* Dual Mode Switcher Tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-secondary/60 border border-border self-start">
              <button
                id="tab-roi-calculator"
                onClick={() => setActiveTab("roi")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "roi"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calculator className="h-3.5 w-3.5 text-accent" />
                Interactive ROI Calculator
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-accent/10 text-accent font-semibold">
                  Live
                </span>
              </button>

              <button
                id="tab-agent-sandbox"
                onClick={() => setActiveTab("sandbox")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === "sandbox"
                    ? "bg-background text-foreground shadow-2xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                Live Agent Sandbox
              </button>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>
                {activeTab === "roi" ? "Real-time Financial Impact Models" : "Deterministic Sandbox Simulation"}
              </span>
            </div>
          </div>

          {activeTab === "roi" ? (
            <ROICalculator />
          ) : (
            <>
          {/* Prompt Selection / Input */}
          <div className="space-y-3">
            <label className="block text-xs font-semibold text-foreground">
              Select or customize an automation prompt:
            </label>
            <div className="flex flex-wrap gap-2">
              {predefinedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setSelectedPrompt(p);
                    handleReset();
                  }}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                    selectedPrompt === p
                      ? "bg-accent text-accent-foreground border-accent font-medium"
                      : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={selectedPrompt}
                onChange={(e) => setSelectedPrompt(e.target.value)}
                placeholder="Enter custom workflow prompt..."
                className="flex-1 text-xs px-4 py-2.5 rounded-xl bg-secondary/40 border border-border focus:outline-none focus:ring-1 focus:ring-ring font-body"
              />
              <Button
                onClick={handleRunSimulation}
                disabled={isRunning}
                className="rounded-xl px-5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 shrink-0 cursor-pointer"
              >
                {isRunning ? (
                  <>
                    <span className="h-3 w-3 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Executing...
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5 fill-primary-foreground" />
                    Run Agent
                  </>
                )}
              </Button>
              {(step > 0 || completed) && (
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="rounded-xl px-3 text-xs shrink-0 cursor-pointer"
                  title="Reset simulator"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Execution Pipeline Visualization */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                Autonomous Execution Pipeline
              </span>
              <span>
                Status:{" "}
                <span className="font-medium text-foreground">
                  {isRunning
                    ? `Processing Step ${step} of 3...`
                    : completed
                    ? "Completed (100% verified)"
                    : "Ready to launch"}
                </span>
              </span>
            </div>

            {/* Pipeline Step Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {executionSteps.map((s, idx) => {
                const stepNum = idx + 1;
                const isStepActive = step === stepNum && isRunning;
                const isStepFinished = step > stepNum || completed;

                return (
                  <div
                    key={s.title}
                    className={`p-4 rounded-xl border transition-all ${
                      isStepActive
                        ? "bg-accent/5 border-accent shadow-xs ring-1 ring-accent"
                        : isStepFinished
                        ? "bg-emerald-50/50 border-emerald-300 text-foreground"
                        : "bg-secondary/20 border-border text-muted-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold">
                        {s.title}
                      </span>
                      {isStepFinished ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      ) : isStepActive ? (
                        <span className="h-3 w-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
                      ) : (
                        <span className="h-2 w-2 rounded-full bg-border" />
                      )}
                    </div>
                    <p className="text-[11px] leading-relaxed opacity-90">
                      {s.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Output / Artifact Preview on completion */}
          <AnimatePresence>
            {completed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                      Settlement Reconciled Without Discrepancy
                    </div>
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                      Hash: sha256:d8a2bc419089 • Approved by policy engine • 0 errors detected
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <Button
                    onClick={() => openDemoModal("Custom Agent")}
                    className="rounded-full px-4 text-xs font-medium bg-emerald-800 text-white hover:bg-emerald-900 cursor-pointer"
                  >
                    Deploy to Your Stack
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
            </>
          )}
        </motion.div>
      </div>
    </motion.section>
  );
};
