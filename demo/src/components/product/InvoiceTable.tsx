import { useState } from "react";
import { formatMoney, invoices, type InvoiceStatus } from "../../data/invoices";
import { cn } from "../../lib/utils";
import { StatusBadge } from "./StatusBadge";

type Filter = "all" | Exclude<InvoiceStatus, "draft">;

const filters: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "overdue", label: "Overdue" },
  { value: "paid", label: "Paid" },
];

export function InvoiceTable() {
  const [filter, setFilter] = useState<Filter>("all");
  const rows = filter === "all" ? invoices : invoices.filter((invoice) => invoice.status === filter);

  return (
    <div id="recent-invoices" className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
        <h3 className="mr-auto text-sm font-medium">Recent invoices</h3>
        <div role="tablist" aria-label="Filter invoices" className="flex rounded-lg bg-neutral-soft p-0.5 text-xs">
          {filters.map(({ value, label }) => {
            const count = value === "all" ? invoices.length : invoices.filter((i) => i.status === value).length;
            return (
              <button
                key={value}
                role="tab"
                aria-selected={filter === value}
                onClick={() => setFilter(value)}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-medium transition-colors",
                  filter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label} <span className="tabular-nums opacity-60">{count}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-[13px]">
          <thead>
            <tr className="border-y border-border text-xs text-muted-foreground">
              <th className="px-4 py-2 font-medium">Invoice</th>
              <th className="px-4 py-2 font-medium">Client</th>
              <th className="px-4 py-2 font-medium">Issued</th>
              <th className="px-4 py-2 font-medium">Due</th>
              <th className="px-4 py-2 font-medium">Amount</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((invoice) => (
              <tr key={invoice.number} className="border-b border-border last:border-0 hover:bg-surface">
                <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{invoice.number}</td>
                <td className="px-4 py-2.5 font-medium">{invoice.client}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{invoice.issued}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{invoice.due}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatMoney(invoice.amount)}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={invoice.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
