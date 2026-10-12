import { useApp } from "../../context/AppContext";
import { formatMoney } from "../../data/invoices";
import { Button } from "../ui/button";

const items = [
  { number: "INV-0144", client: "Harbor & Vine", note: "6 days overdue", amount: 2400, overdue: true },
  { number: "INV-0141", client: "Northfield Dental", note: "14 days overdue", amount: 750, overdue: true },
  { number: "INV-0146", client: "Copperleaf Films", note: "Due in 3 days", amount: 5800, overdue: false },
];

export function NeedsAttention() {
  const { showToast } = useApp();

  return (
    <div className="flex flex-col rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-medium">Needs attention</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Reminders go out automatically</p>
      <ul className="mt-3 flex flex-1 flex-col divide-y divide-border">
        {items.map((item) => (
          <li key={item.number} className="flex items-center gap-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{item.client}</p>
              <p className={item.overdue ? "text-xs text-danger" : "text-xs text-muted-foreground"}>
                {item.note} · {formatMoney(item.amount)}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => showToast({ title: `Reminder sent to ${item.client}`, description: `${item.number} · ${formatMoney(item.amount)}` })}
            >
              Remind
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
