import { BarChart3, ChevronsUpDown, CreditCard, FileText, LayoutDashboard, Repeat, Settings, Users } from "lucide-react";
import { cn } from "../../lib/utils";
import { LogoMark } from "../ui/Logo";

const nav = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Invoices", icon: FileText, count: 7 },
  { label: "Recurring", icon: Repeat },
  { label: "Clients", icon: Users },
  { label: "Payments", icon: CreditCard },
  { label: "Reports", icon: BarChart3 },
];

export function AppSidebar() {
  return (
    <aside className="hidden w-52 shrink-0 flex-col border-r border-border bg-surface p-3 md:flex">
      <button className="flex cursor-pointer items-center gap-2 rounded-lg p-1.5 text-left hover:bg-neutral-soft">
        <LogoMark className="size-6" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">Fieldwork Studio</span>
        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
      </button>

      <nav className="mt-4 flex flex-col gap-0.5" aria-label="App">
        {nav.map(({ label, icon: Icon, active, count }) => (
          <a
            key={label}
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[13px]",
              active ? "bg-card font-medium text-foreground shadow-sm ring-1 ring-border" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            <span className="flex-1">{label}</span>
            {count && <span className="text-xs tabular-nums text-muted-foreground">{count}</span>}
          </a>
        ))}
      </nav>

      <div className="mt-auto flex items-center gap-2 border-t border-border px-1 pt-3">
        <span className="grid size-7 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand">MC</span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">Maya Chen</p>
          <p className="text-[11px] text-muted-foreground">Owner</p>
        </div>
        <Settings className="size-4 text-muted-foreground" />
      </div>
    </aside>
  );
}
