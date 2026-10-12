import React, { useState } from "react";
import { motion } from "framer-motion";
import { Check, Sparkles, HelpCircle } from "lucide-react";
import { Button } from "./ui/button";
import { useApp } from "../context/AppContext";
import {
  staggerContainerVariants,
  staggerItemVariants,
} from "./ui/ScrollReveal";

export const Pricing: React.FC = () => {
  const { openDemoModal } = useApp();
  const [isAnnual, setIsAnnual] = useState(true);

  const plans = [
    {
      name: "Starter",
      description: "For startups automating core banking, invoicing, and vendor payouts.",
      monthlyPrice: 149,
      annualPrice: 119,
      features: [
        "Up to 1,000 automated workflow executions / mo",
        "Bi-directional Harbor & Payflow connectors",
        "Single-level human approval thresholds",
        "Community & email support (4h SLA)",
        "Audit log retention: 30 days",
      ],
      ctaText: "Start Starter Trial",
      popular: false,
    },
    {
      name: "Growth",
      description: "For scaling finance and engineering teams requiring dual-key safeguards.",
      monthlyPrice: 499,
      annualPrice: 399,
      features: [
        "Unlimited automated workflow executions",
        "All 100+ native connectors (Nimbus, Spendly, Trackline, etc.)",
        "Dual-key cryptographic sign-off rules",
        "Shared chat channel with systems engineer (15m SLA)",
        "Self-healing schema drift protection",
        "Audit log retention: 1 year (exportable)",
      ],
      ctaText: "Get Started with Growth",
      popular: true,
    },
    {
      name: "Enterprise",
      description: "For regulated institutions demanding private VPC isolation and custom SLAs.",
      monthlyPrice: "Custom",
      annualPrice: "Custom",
      features: [
        "Dedicated private VPC agent container isolation",
        "Custom ERP & proprietary banking rail connectors",
        "Role-based RBAC with SAML / Okta SSO",
        "Full audit exports and access reviews",
        "Dedicated Enterprise Solutions Architect",
        "99.99% contractual uptime SLA",
      ],
      ctaText: "Talk to Enterprise Sales",
      popular: false,
    },
  ];

  return (
    <motion.section
      id="pricing"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1, margin: "0px 0px -40px 0px" }}
      transition={{ duration: 0.65, ease: [0.21, 0.47, 0.32, 0.98] }}
      className="w-full py-20 px-6 md:px-12 lg:px-20 font-body bg-secondary/20 border-y border-border"
    >
      <div className="max-w-6xl mx-auto space-y-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px 0px -50px 0px" }}
          transition={{ duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="text-center max-w-xl mx-auto space-y-3"
        >
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium">
            Predictable Pricing
          </div>
          <h2 className="font-display text-3xl md:text-5xl tracking-tight text-foreground leading-tight">
            Transparent plans for <span className="italic">every</span> operational stage.
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            No surprise overages. Scale your autonomous workforce with predictable computing tiers.
          </p>

          {/* Billing Interval Toggle */}
          <div className="pt-3 flex items-center justify-center gap-3">
            <span
              className={`text-xs ${
                !isAnnual ? "font-semibold text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly billing
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative w-11 h-6 rounded-full bg-secondary border border-border transition-colors cursor-pointer p-0.5"
              aria-label="Toggle annual or monthly pricing"
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-accent transition-transform ${
                  isAnnual ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <div className="flex items-center gap-1.5">
              <span
                className={`text-xs ${
                  isAnnual ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                Annual billing
              </span>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                Save 20%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <motion.div
          variants={staggerContainerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "0px 0px -40px 0px" }}
          custom={{ stagger: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch"
        >
          {plans.map((plan) => {
            const price =
              typeof plan.annualPrice === "number"
                ? isAnnual
                  ? plan.annualPrice
                  : plan.monthlyPrice
                : "Custom";

            return (
              <motion.div
                key={plan.name}
                variants={staggerItemVariants}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className={`rounded-2xl p-7 flex flex-col justify-between transition-shadow bg-background border ${
                  plan.popular
                    ? "border-accent ring-2 ring-accent/20 shadow-xl relative"
                    : "border-border shadow-2xs hover:shadow-md"
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground text-[10px] font-semibold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Most Popular
                  </div>
                )}

                <div className="space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      {plan.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {plan.description}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1 pt-2 border-t border-border">
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {typeof price === "number" ? `$${price}` : price}
                    </span>
                    {typeof price === "number" && (
                      <span className="text-xs text-muted-foreground">
                        / month {isAnnual && "(billed annually)"}
                      </span>
                    )}
                  </div>

                  {/* Feature Checklist */}
                  <div className="space-y-3 pt-2">
                    <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
                      Included capabilities:
                    </span>
                    <ul className="space-y-2.5">
                      {plan.features.map((feat) => (
                        <li
                          key={feat}
                          className="flex items-start gap-2.5 text-xs text-foreground"
                        >
                          <Check className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="pt-8">
                  <Button
                    onClick={() => openDemoModal(plan.name)}
                    className={`w-full rounded-full py-5 text-xs font-medium cursor-pointer transition-all ${
                      plan.popular
                        ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {plan.ctaText}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </motion.section>
  );
};
