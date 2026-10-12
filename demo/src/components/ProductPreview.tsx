import { Plus, Search } from "lucide-react";
import { AppSidebar } from "./product/AppSidebar";
import { InvoiceTable } from "./product/InvoiceTable";
import { NeedsAttention } from "./product/NeedsAttention";
import { RevenueChart } from "./product/RevenueChart";
import { StatCard } from "./product/StatCard";
import { Button } from "./ui/button";

/** The Sorrel app itself, coded (not an image), shown under the hero. */
export function ProductPreview() {
  return (
    <div
      id="product-preview"
      className="flex overflow-hidden rounded-2xl border border-border bg-card text-left shadow-window"
    >
      <AppSidebar />

      <div className="min-w-0 flex-1 bg-background">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-3.5">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Overview</h2>
            <p className="text-xs text-muted-foreground">October 2026</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="hidden h-8 w-56 items-center gap-2 rounded-lg border border-input bg-card px-2.5 text-[13px] text-muted-foreground lg:flex">
              <Search className="size-3.5" />
              <input className="w-full bg-transparent outline-none placeholder:text-muted-foreground" placeholder="Search invoices" />
            </label>
            <Button variant="brand" size="sm">
              <Plus className="size-3.5" />
              New invoice
            </Button>
          </div>
        </header>

        <div className="space-y-4 p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Outstanding" value="$16,150" detail="4 invoices" />
            <StatCard label="Overdue" value="$3,150" detail="2 invoices" tone="negative" />
            <StatCard label="Paid this month" value="$26,880" detail="+12% vs September" tone="positive" />
            <StatCard label="Average days to pay" value="9.4" detail="Down from 15.2" tone="positive" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart />
            </div>
            <NeedsAttention />
          </div>

          <InvoiceTable />
        </div>
      </div>
    </div>
  );
}
