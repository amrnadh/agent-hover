import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../lib/utils";

const questions = [
  {
    q: "How do my clients pay?",
    a: "Each invoice email has a link to a payment page. Clients pay by card or bank transfer without creating an account, and the invoice is marked paid when the money arrives.",
  },
  {
    q: "Can I bring my existing invoices?",
    a: "Yes. Import a CSV of clients and past invoices from your current tool. Invoice numbers carry on from where you left off.",
  },
  {
    q: "What does the free trial include?",
    a: "Everything in the Studio plan for 14 days. No card is needed to start, and you can send real invoices during the trial.",
  },
  {
    q: "Do you take a cut of payments?",
    a: "No. Card processing fees are passed through at cost and bank transfers are free. You only pay for your plan.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-24">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="text-3xl font-semibold tracking-[-0.03em]">Questions</h2>
          <p className="mt-3 text-muted-foreground">
            Something else? Write to us and a person will answer within a working day.
          </p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          {questions.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.q}>
                <h3>
                  <button
                    aria-expanded={isOpen}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-4 py-4 text-left font-medium"
                  >
                    {item.q}
                    <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                </h3>
                {isOpen && <p className="pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
