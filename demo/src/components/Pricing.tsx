import { useState } from "react";
import { Check } from "lucide-react";
import { useApp } from "../context/AppContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

type Billing = "monthly" | "yearly";

interface Plan {
  name: string;
  description: string;
  monthly: number;
  yearly: number;
  features: string[];
  cta: "trial" | "demo";
  featured?: boolean;
}

const plans: Plan[] = [
  {
    name: "Solo",
    description: "For freelancers billing on their own.",
    monthly: 12,
    yearly: 10,
    features: ["Unlimited invoices and clients", "Card and bank transfer payments", "Automatic reminders"],
    cta: "trial",
  },
  {
    name: "Studio",
    description: "For small teams with retainers and projects.",
    monthly: 39,
    yearly: 32,
    features: ["Everything in Solo", "Up to 10 teammates", "Recurring invoices", "Any currency", "Cash flow reports"],
    cta: "trial",
    featured: true,
  },
  {
    name: "Agency",
    description: "For agencies with approvals and many clients.",
    monthly: 89,
    yearly: 74,
    features: ["Everything in Studio", "Unlimited teammates", "Invoice approvals", "Exports and API access", "Priority support"],
    cta: "demo",
  },
];

export function Pricing() {
  const [billing, setBilling] = useState<Billing>("yearly");
  const { openDemoDialog, showToast } = useApp();

  return (
    <section id="pricing" className="py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-xl text-center">
          <p className="text-sm font-medium text-brand">Pricing</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Simple plans, no payment cut</h2>
          <p className="mt-4 text-muted-foreground">Every plan starts with a 14-day trial. Card fees are passed through at cost.</p>
        </div>

        <div role="radiogroup" aria-label="Billing period" className="mx-auto mt-8 flex w-fit rounded-full border border-border bg-surface p-1 text-sm">
          {(["monthly", "yearly"] as const).map((period) => (
            <button
              key={period}
              role="radio"
              aria-checked={billing === period}
              onClick={() => setBilling(period)}
              className={cn(
                "cursor-pointer rounded-full px-4 py-1.5 font-medium transition-colors",
                billing === period ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {period === "monthly" ? "Monthly" : "Yearly"}
              {period === "yearly" && <span className="ml-1.5 text-xs text-brand">2 months free</span>}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {plans.map((plan) => (
            <article
              key={plan.name}
              className={cn(
                "flex flex-col rounded-2xl border bg-card p-6",
                plan.featured ? "border-foreground/80 shadow-window" : "border-border",
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{plan.name}</h3>
                {plan.featured && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">Most popular</span>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
              <p className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight tabular-nums">${plan[billing]}</span>
                <span className="text-sm text-muted-foreground">/ month</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{billing === "yearly" ? "Billed yearly" : "Billed monthly"}</p>
              <Button
                variant={plan.featured ? "default" : "outline"}
                className="mt-6 w-full"
                onClick={() =>
                  plan.cta === "demo"
                    ? openDemoDialog(plan.name)
                    : showToast({ title: `${plan.name} trial started`, description: "Check your inbox to finish setting up." })
                }
              >
                {plan.cta === "demo" ? "Book a demo" : "Start free trial"}
              </Button>
              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                    {feature}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
