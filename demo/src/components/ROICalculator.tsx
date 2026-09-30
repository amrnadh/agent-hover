import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Clock,
  DollarSign,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";

export const ROICalculator: React.FC = () => {
  const { openDemoModal, addToast } = useApp();

  // Inputs
  const [teamSize, setTeamSize] = useState<number>(15);
  const [manualHoursPerWeek, setManualHoursPerWeek] = useState<number>(14);
  const [hourlyRate, setHourlyRate] = useState<number>(65);
  const [copied, setCopied] = useState<boolean>(false);

  // Industry verified automation efficiency: 78% of repetitive back-office, ledger, and approval tasks
  const automationRate = 0.78;

  // Real-time calculations
  const totalWeeklyManualHours = teamSize * manualHoursPerWeek;
  const weeklyHoursSaved = Math.round(totalWeeklyManualHours * automationRate);
  const annualHoursSaved = weeklyHoursSaved * 52;
  const annualCostSaved = annualHoursSaved * hourlyRate;
  const freedFTEEquivalent = (annualHoursSaved / 2080).toFixed(1);
  const weeklyCostSaved = Math.round(weeklyHoursSaved * hourlyRate);

  const teamPresets = [
    { label: "Startup (5)", size: 5, hours: 10 },
    { label: "Core Growth (15)", size: 15, hours: 14 },
    { label: "Mid-Market (45)", size: 45, hours: 18 },
    { label: "Enterprise (120)", size: 120, hours: 22 },
  ];

  const handleCopySummary = () => {
    const summary = `Nexora Projected ROI Summary:
• Team Size: ${teamSize} operations & finance specialists
• Current Manual Workload: ${manualHoursPerWeek} hrs/week per person
• Annual Hours Reclaimed: ${annualHoursSaved.toLocaleString()} hours/year
• Annual Projected Cost Savings: $${annualCostSaved.toLocaleString()}
• Reallocated Capacity: ${freedFTEEquivalent} full-time equivalents
• Automation Rate: ${(automationRate * 100).toFixed(0)}% autonomous task resolution`;

    navigator.clipboard.writeText(summary).then(() => {
      setCopied(true);
      addToast({
        title: "ROI Summary Copied",
        description: "Ready to share with your leadership or finance committee",
        type: "success",
      });
      setTimeout(() => setCopied(false), 3000);
    });
  };

  const handleReset = () => {
    setTeamSize(15);
    setManualHoursPerWeek(14);
    setHourlyRate(65);
  };

  return (
    <div id="roi-calculator-container" className="space-y-8 font-body">
      {/* Top Banner / Explanation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-accent" />
            Quantify Your Autonomous Operational Savings
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Model the exact hours and capital recovered when repetitive financial ledgers, approvals, and reconciliations are offloaded to Nexora.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-lg border border-border bg-secondary/30 hover:bg-secondary transition-colors cursor-pointer"
            title="Reset to default values"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>

          <button
            onClick={handleCopySummary}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-secondary/80 transition-colors cursor-pointer shadow-2xs"
            title="Copy calculations summary"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3 w-3 text-muted-foreground" />
                Copy Summary
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preset Quick Chips */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground font-medium mr-1">Presets:</span>
        {teamPresets.map((preset) => (
          <button
            key={preset.label}
            onClick={() => {
              setTeamSize(preset.size);
              setManualHoursPerWeek(preset.hours);
            }}
            className={`px-3 py-1 rounded-full border text-xs transition-all cursor-pointer ${
              teamSize === preset.size && manualHoursPerWeek === preset.hours
                ? "bg-accent text-accent-foreground border-accent font-medium shadow-2xs"
                : "bg-secondary/40 border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Two Column Layout: Controls (Left) vs Output Dashboard (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Input Sliders & Number Controls */}
        <div className="lg:col-span-6 space-y-6 bg-secondary/20 p-5 md:p-6 rounded-2xl border border-border">
          {/* 1. Team Size Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="team-size-slider" className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Users className="h-3.5 w-3.5 text-accent" />
                Operations & Finance Team Size
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="team-size-input"
                  type="number"
                  min="1"
                  max="500"
                  value={teamSize}
                  onChange={(e) => setTeamSize(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center text-xs font-semibold py-1 px-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-muted-foreground">members</span>
              </div>
            </div>

            <input
              id="team-size-slider"
              type="range"
              min="1"
              max="150"
              step="1"
              value={teamSize}
              onChange={(e) => setTeamSize(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>1 member</span>
              <span>75 members</span>
              <span>150+ members</span>
            </div>
          </div>

          {/* 2. Manual Task Hours / Week Control */}
          <div className="space-y-3 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between">
              <label htmlFor="manual-hours-slider" className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-accent" />
                Manual Task Hours / Person / Week
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="manual-hours-input"
                  type="number"
                  min="1"
                  max="40"
                  value={manualHoursPerWeek}
                  onChange={(e) => setManualHoursPerWeek(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 text-center text-xs font-semibold py-1 px-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-muted-foreground">hrs/wk</span>
              </div>
            </div>

            <input
              id="manual-hours-slider"
              type="range"
              min="2"
              max="35"
              step="1"
              value={manualHoursPerWeek}
              onChange={(e) => setManualHoursPerWeek(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>2 hrs (Light)</span>
              <span>18 hrs (Average)</span>
              <span>35 hrs (Heavy friction)</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Includes transaction reconciliation, cross-system ERP data sync, receipt matching, and compliance validation.
            </p>
          </div>

          {/* 3. Blended Compensation Rate */}
          <div className="space-y-3 pt-2 border-t border-border/70">
            <div className="flex items-center justify-between">
              <label htmlFor="hourly-rate-slider" className="text-xs font-semibold text-foreground flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5 text-accent" />
                Blended Hourly Labor Cost
              </label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">$</span>
                <input
                  id="hourly-rate-input"
                  type="number"
                  min="20"
                  max="250"
                  value={hourlyRate}
                  onChange={(e) => setHourlyRate(Math.max(20, parseInt(e.target.value) || 20))}
                  className="w-16 text-center text-xs font-semibold py-1 px-2 rounded-lg bg-background border border-border text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                />
                <span className="text-xs text-muted-foreground">/ hr</span>
              </div>
            </div>

            <input
              id="hourly-rate-slider"
              type="range"
              min="30"
              max="150"
              step="5"
              value={hourlyRate}
              onChange={(e) => setHourlyRate(parseInt(e.target.value))}
              className="w-full h-2 bg-secondary rounded-lg appearance-none cursor-pointer accent-accent"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
              <span>$30/hr</span>
              <span>$65/hr (Benchmark)</span>
              <span>$150/hr</span>
            </div>
          </div>
        </div>

        {/* Right: Dynamic High-Contrast Metrics Projection */}
        <div className="lg:col-span-6 space-y-5">
          {/* Main Hero Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Annual Hours Saved */}
            <div className="p-5 rounded-2xl bg-background border border-border shadow-xs hover:border-accent/40 transition-colors space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Annual Hours Saved</span>
                <Clock className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-body">
                {annualHoursSaved.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-1">hrs/yr</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ~{weeklyHoursSaved.toLocaleString()} hrs reclaimed every week across your team.
              </p>
            </div>

            {/* Projected Capital Savings */}
            <div className="p-5 rounded-2xl bg-background border border-border shadow-xs hover:border-emerald-500/40 transition-colors space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Projected Cost Savings</span>
                <DollarSign className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 font-body">
                ${annualCostSaved.toLocaleString()}
                <span className="text-xs font-normal text-muted-foreground ml-1">/year</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ${weeklyCostSaved.toLocaleString()} in operational value recovered weekly.
              </p>
            </div>

            {/* Capacity Reallocation (FTEs) */}
            <div className="p-5 rounded-2xl bg-background border border-border shadow-xs hover:border-accent/40 transition-colors space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">FTE Capacity Reallocated</span>
                <Users className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-body">
                {freedFTEEquivalent}
                <span className="text-xs font-normal text-muted-foreground ml-1">FTEs</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Equivalent full-time talent unburdened to focus on strategic growth.
              </p>
            </div>

            {/* Turnaround Acceleration */}
            <div className="p-5 rounded-2xl bg-background border border-border shadow-xs hover:border-accent/40 transition-colors space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium">Close Acceleration</span>
                <Sparkles className="h-4 w-4 text-accent" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground font-body">
                4.8x
                <span className="text-xs font-normal text-muted-foreground ml-1">faster</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Compressing multi-day financial reconciliation into continuous execution.
              </p>
            </div>
          </div>

          {/* Workflow Distribution Visualizer */}
          <div className="p-5 rounded-2xl bg-secondary/30 border border-border space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground">Automation Distribution</span>
              <span className="text-accent font-medium">78% Autonomous Offload</span>
            </div>

            <div className="h-3 w-full bg-secondary rounded-full overflow-hidden flex border border-border/80">
              <div
                className="h-full bg-accent transition-all duration-500 rounded-l-full"
                style={{ width: "78%" }}
                title="78% Autonomous Execution by Nexora"
              />
              <div
                className="h-full bg-muted-foreground/30 transition-all duration-500 rounded-r-full"
                style={{ width: "22%" }}
                title="22% High-level Human Policy Oversight"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Autonomous execution (Ledgers, Invoicing, Matching)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                Exception review only (22%)
              </span>
            </div>
          </div>

          {/* Consultation CTA Banner */}
          <div className="p-4 rounded-xl bg-background border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="space-y-0.5">
              <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Request Custom Architecture Assessment
              </div>
              <div className="text-[11px] text-muted-foreground">
                Get an audited time-study benchmark tailored to your specific ERP & banking stack.
              </div>
            </div>

            <Button
              onClick={() => openDemoModal(`ROI Assessment (${teamSize} team members)`)}
              className="rounded-full px-4 py-2 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer"
            >
              Book Custom ROI Review
              <ArrowRight className="h-3 w-3 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
