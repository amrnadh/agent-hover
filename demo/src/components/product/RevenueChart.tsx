import { formatMoney, monthlyCash } from "../../data/invoices";

const ticks = [50000, 40000, 30000, 20000, 10000, 0];
const MAX = ticks[0];

export function RevenueChart() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium">Cash collected</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Last 6 months</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-brand" /> Paid
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-sm bg-chart-muted" /> Outstanding
          </span>
        </div>
      </div>

      <div className="relative mt-5 h-44">
        <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between">
          {ticks.map((tick) => (
            <div key={tick} className="flex h-0 items-center gap-2">
              <span className="w-7 text-right text-[11px] tabular-nums text-muted-foreground">
                {tick === 0 ? "0" : `${tick / 1000}k`}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
          ))}
        </div>
        <div className="absolute top-0 right-0 bottom-6 left-9 flex items-end justify-around gap-3">
          {monthlyCash.map(({ month, paid, outstanding }) => (
            <div key={month} className="relative flex h-full w-full max-w-10 flex-col justify-end">
              <div
                title={`${month}: ${formatMoney(paid)} paid${outstanding ? `, ${formatMoney(outstanding)} outstanding` : ""}`}
                className="flex w-full flex-col overflow-hidden rounded-t-md"
                style={{ height: `${((paid + outstanding) / MAX) * 100}%` }}
              >
                {outstanding > 0 && <div className="bg-chart-muted" style={{ flexGrow: outstanding }} />}
                <div className="bg-brand" style={{ flexGrow: paid }} />
              </div>
              <span className="absolute inset-x-0 top-full mt-1.5 text-center text-[11px] text-muted-foreground">{month}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
