import { Banknote, Check, FileDown, Globe } from "lucide-react";
import { formatMoney } from "../data/invoices";
import { cn } from "../lib/utils";

function InvoiceSketch() {
  const lines = [
    { item: "Brand workshop", qty: 2, rate: 1200 },
    { item: "Website design", qty: 1, rate: 4800 },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-[13px] shadow-sm">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">INV-0148</span>
        <span className="text-xs text-muted-foreground">Alder & Finch</span>
      </div>
      <div className="mt-3 space-y-1.5">
        {lines.map((line) => (
          <div key={line.item} className="flex justify-between">
            <span>
              {line.item} <span className="text-muted-foreground">× {line.qty}</span>
            </span>
            <span className="tabular-nums">{formatMoney(line.qty * line.rate)}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between border-t border-border pt-2.5 font-semibold">
        <span>Total</span>
        <span className="tabular-nums">{formatMoney(7200)}</span>
      </div>
    </div>
  );
}

function ReminderSketch() {
  const steps = [
    { date: "Oct 9", label: "Invoice sent", done: true },
    { date: "Oct 20", label: "Friendly nudge, 3 days before", done: false },
    { date: "Oct 23", label: "Due date", done: false },
    { date: "Oct 30", label: "Follow-up if still unpaid", done: false },
  ];
  return (
    <ol className="rounded-lg border border-border bg-card p-4 text-[13px] shadow-sm">
      {steps.map((step) => (
        <li key={step.date} className="relative flex gap-3 pb-3 last:pb-0">
          <span
            className={cn(
              "mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border",
              step.done ? "border-brand bg-brand text-brand-foreground" : "border-input bg-card",
            )}
          >
            {step.done && <Check className="size-2.5" strokeWidth={3} />}
          </span>
          <span className="flex-1">{step.label}</span>
          <span className="text-xs text-muted-foreground tabular-nums">{step.date}</span>
        </li>
      ))}
    </ol>
  );
}

function CashSketch() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-[13px] shadow-sm">
      <p className="text-xs text-muted-foreground">Expected in October</p>
      <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">{formatMoney(43030)}</p>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-neutral-soft">
        <div className="bg-brand" style={{ width: "62%" }} />
        <div className="bg-chart-muted" style={{ width: "31%" }} />
      </div>
      <div className="mt-2.5 flex justify-between text-xs text-muted-foreground">
        <span>
          <span className="font-medium text-foreground">{formatMoney(26880)}</span> collected
        </span>
        <span>
          <span className="font-medium text-foreground">{formatMoney(16150)}</span> on the way
        </span>
      </div>
    </div>
  );
}

const highlights = [
  {
    title: "Invoices in under a minute",
    body: "Start from a client and your usual rates. Your logo, tax and payment terms are filled in, and retainers repeat on their own.",
    sketch: <InvoiceSketch />,
  },
  {
    title: "Follow-ups you don't have to write",
    body: "Polite reminders go out before and after the due date, from your own address, and stop the moment a client pays.",
    sketch: <ReminderSketch />,
  },
  {
    title: "Know where your cash stands",
    body: "See what's been paid, what's on the way and what's late, without opening a spreadsheet.",
    sketch: <CashSketch />,
  },
];

const extras = [
  { icon: Banknote, title: "Card and bank transfer", body: "Clients pay from the invoice email. No account needed." },
  { icon: Globe, title: "Any currency", body: "Bill in your client's currency and get paid in yours." },
  { icon: FileDown, title: "Exports for your accountant", body: "CSV and PDF at month end, with every payment matched." },
];

export function Features() {
  return (
    <section id="features" className="border-y border-border bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-brand">Product</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
            Everything between “done” and “paid”
          </h2>
          <p className="mt-4 text-muted-foreground">
            Sorrel takes care of the admin after the work is delivered, so you're not chasing payments on a Friday afternoon.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {highlights.map((feature) => (
            <article key={feature.title} className="rounded-2xl border border-border bg-background p-2">
              <div className="flex h-56 flex-col justify-center rounded-xl bg-surface p-4">{feature.sketch}</div>
              <div className="p-4 pt-5">
                <h3 className="font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{feature.body}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-12 grid gap-8 sm:grid-cols-3">
          {extras.map(({ icon: Icon, title, body }) => (
            <div key={title} className="flex gap-3">
              <Icon className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
