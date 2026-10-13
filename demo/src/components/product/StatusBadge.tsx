import type { InvoiceStatus } from "../../data/invoices";
import { cn } from "../../lib/utils";

const styles: Record<InvoiceStatus, string> = {
  paid: "bg-brand-soft text-brand",
  open: "bg-neutral-soft text-foreground",
  overdue: "bg-danger-soft text-danger",
  draft: "bg-transparent text-muted-foreground ring-1 ring-inset ring-border",
};

const labels: Record<InvoiceStatus, string> = {
  paid: "Paid",
  open: "Open",
  overdue: "Overdue",
  draft: "Draft",
};

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", styles[status])}>
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {labels[status]}
    </span>
  );
}
