import React, { useState } from "react";
import {
  ChevronDown,
  Search,
  Bell,
  Check,
  Plus,
  MoreVertical,
  Home,
  CheckSquare,
  ArrowLeftRight,
  CreditCard,
  Building2,
  PieChart,
  Layers,
  Settings,
  Sparkles,
} from "lucide-react";
import { useApp } from "../context/AppContext";

interface Transaction {
  id: string;
  date: string;
  desc: string;
  amount: string;
  status: "Completed" | "Pending";
  isPositive?: boolean;
}

export const DashboardPreview: React.FC = () => {
  const { openCommandMenu, addToast } = useApp();
  const [activeTab, setActiveTab] = useState<string>("Home");
  const [balance, setBalance] = useState<number>(8450190.32);
  const [transactions, setTransactions] = useState<Transaction[]>([
    {
      id: "1",
      date: "Today",
      desc: "Nimbus Cloud Infrastructure",
      amount: "-$5,200.00",
      status: "Pending",
    },
    {
      id: "2",
      date: "Yesterday",
      desc: "Client Payment (Payflow)",
      amount: "+$125,000.00",
      status: "Completed",
      isPositive: true,
    },
    {
      id: "3",
      date: "Sep 19",
      desc: "Payroll (Paystream)",
      amount: "-$85,450.00",
      status: "Completed",
    },
    {
      id: "4",
      date: "Sep 18",
      desc: "Office Supplies",
      amount: "-$1,200.00",
      status: "Completed",
    },
  ]);

  const handleAction = (actionName: string) => {
    if (actionName === "Send") {
      setBalance((prev) => prev - 15000);
      setTransactions((prev) => [
        {
          id: Math.random().toString(),
          date: "Just now",
          desc: "Vendor Settlement (Wire)",
          amount: "-$15,000.00",
          status: "Completed",
        },
        ...prev.slice(0, 3),
      ]);
      addToast({
        title: "Vendor Settlement Processed",
        description: "Sent $15,000.00 via Harbor Wire Network.",
        type: "success",
      });
    } else if (actionName === "Create Invoice") {
      addToast({
        title: "Invoice #INV-2026-88 Created",
        description: "Automated agent dispatched draft to client.",
        type: "success",
      });
    } else {
      addToast({
        title: `${actionName} initiated`,
        description: "Intelligent agent queued workflow for execution.",
        type: "info",
      });
    }
  };

  const formattedBalance = Math.floor(balance).toLocaleString();
  const balanceCents = (balance % 1).toFixed(2).substring(1);

  return (
    <div
      id="dashboard-preview-card"
      className="w-full rounded-2xl overflow-hidden p-3 md:p-4 backdrop-blur-md transition-all hover:shadow-2xl"
      style={{
        background: "var(--dashboard-glass)",
        border: "1px solid var(--dashboard-glass-border)",
        boxShadow: "var(--shadow-dashboard)",
      }}
    >
      {/* Dashboard internals */}
      <div className="bg-background rounded-xl border border-border/80 shadow-sm overflow-hidden flex flex-col text-[11px] text-foreground font-body">
        {/* Top bar */}
        <div className="h-11 px-3.5 border-b border-border flex items-center justify-between bg-background">
          {/* Logo "N" in rounded box + "Nexora" + chevron */}
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div className="h-5 w-5 rounded bg-primary text-primary-foreground flex items-center justify-center font-bold text-[10px] shadow-xs">
              N
            </div>
            <span className="font-semibold text-xs tracking-tight text-foreground">
              Nexora
            </span>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>

          {/* Search bar with ⌘K shortcut - interactive click */}
          <button
            onClick={openCommandMenu}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1 bg-secondary/80 border border-border/80 rounded-md w-60 text-muted-foreground hover:bg-secondary transition-colors text-left"
            title="Click or press ⌘K"
          >
            <Search className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] flex-1">Search or jump to...</span>
            <kbd className="text-[9px] bg-background border border-border/80 px-1 py-0.5 rounded shadow-2xs font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* "Move Money" + bell + avatar "JB" */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => handleAction("Transfer")}
              className="hidden xs:flex items-center px-2 py-1 rounded bg-secondary text-foreground text-[10px] font-medium border border-border hover:bg-secondary/80 transition-colors"
            >
              Move Money
            </button>
            <button
              onClick={() =>
                addToast({
                  title: "Agent Notification",
                  description: "2 reconciliation workflows completed with 0 errors.",
                  type: "info",
                })
              }
              className="relative text-muted-foreground hover:text-foreground transition-colors p-1"
              aria-label="Notifications"
            >
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute 0 top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-accent" />
            </button>
            <div
              className="h-6 w-6 rounded-full bg-[#83838b] text-[#f1f1f1] font-semibold text-[10px] flex items-center justify-center border border-accent/30 select-none"
              style={{ backgroundColor: "#83838b", color: "#f1f1f1" }}
            >
              JB
            </div>
          </div>
        </div>

        {/* Dashboard Body */}
        <div className="flex flex-row">
          {/* Sidebar (w-40) */}
          <div className="w-40 border-r border-border bg-background p-2.5 flex flex-col justify-between hidden md:flex shrink-0">
            <div className="space-y-4">
              {/* Primary Nav Items */}
              <div className="space-y-0.5">
                {[
                  { name: "Home", icon: Home },
                  { name: "Tasks", icon: CheckSquare, badge: "10" },
                  { name: "Transactions", icon: ArrowLeftRight },
                  { name: "Payments", icon: CreditCard, hasChevron: true },
                  { name: "Cards", icon: CreditCard },
                  { name: "Capital", icon: PieChart },
                  { name: "Accounts", icon: Building2, hasChevron: true },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => setActiveTab(item.name)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-left transition-colors ${
                        isActive
                          ? "bg-secondary text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        <span>{item.name}</span>
                      </div>
                      {item.badge && (
                        <span className="text-[9px] font-semibold bg-secondary px-1.5 py-0.2 rounded-full text-foreground">
                          {item.badge}
                        </span>
                      )}
                      {item.hasChevron && <ChevronDown className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>

              {/* Section "Workflows" */}
              <div className="pt-2 border-t border-border">
                <div className="px-2 pb-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">
                  Workflows
                </div>
                <div className="space-y-0.5">
                  {[
                    { name: "Trake rutes", icon: Layers },
                    { name: "Payments", icon: CreditCard },
                    { name: "Notifications", icon: Bell },
                    { name: "Settings", icon: Settings },
                  ].map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.name}
                        onClick={() =>
                          addToast({
                            title: `Workflow: ${sub.name}`,
                            description: "Automated routing rules active.",
                            type: "info",
                          })
                        }
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/50 text-left transition-colors"
                      >
                        <SubIcon className="h-3.5 w-3.5" />
                        <span>{sub.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Main content (bg-secondary/30) */}
          <div className="flex-1 bg-secondary/30 p-3.5 space-y-3.5 overflow-hidden">
            {/* Greeting: "Welcome, Jane" — text-sm font-semibold */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  Welcome, Jane
                </h2>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Agents Synchronized
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Updated moments ago
              </span>
            </div>

            {/* Action buttons row: Send (primary/accent), Request, Transfer, Deposit, Pay Bill, Create Invoice — rounded-full pill buttons text-[10px], + "Customize" text */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleAction("Send")}
                className="rounded-full px-3 py-1 text-[10px] font-medium bg-[#9292a1] text-accent-foreground shadow-2xs hover:opacity-90 active:scale-95 transition-all cursor-pointer"
                style={{ backgroundColor: "#9292a1" }}
              >
                Send
              </button>
              {["Request", "Transfer", "Deposit", "Pay Bill", "Create Invoice"].map(
                (btn) => (
                  <button
                    key={btn}
                    onClick={() => handleAction(btn)}
                    className="rounded-full px-3 py-1 text-[10px] font-medium bg-background border border-border text-foreground hover:bg-secondary active:scale-95 transition-all cursor-pointer"
                  >
                    {btn}
                  </button>
                )
              )}
              <button
                onClick={() =>
                  addToast({
                    title: "Quick Action Customizer",
                    description: "Reorder actions or add Webhook triggers.",
                    type: "info",
                  })
                }
                className="ml-auto text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                + Customize
              </button>
            </div>

            {/* Two equal-width cards (flex-1 basis-0) side by side */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              {/* Balance card */}
              <div className="flex-1 basis-0 rounded-lg bg-background p-3.5 border border-border shadow-2xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <span>Harbor Balance</span>
                    <span className="h-3 w-3 rounded-full bg-accent/15 text-accent flex items-center justify-center">
                      <Check className="h-2 w-2 stroke-[3]" />
                    </span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-0.5">
                    <span className="text-xl font-bold tracking-tight text-foreground">
                      ${formattedBalance}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {balanceCents}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[10px]">
                    <span className="text-muted-foreground">Last 30 Days</span>
                    <span className="font-medium text-emerald-600">
                      +$1.8M
                    </span>
                    <span className="font-medium text-rose-500">-$900K</span>
                  </div>
                </div>

                {/* SVG area chart (h-20) with smooth cubic Bézier curve */}
                <div className="h-20 w-full mt-2 relative">
                  <svg
                    viewBox="0 0 320 80"
                    preserveAspectRatio="none"
                    className="w-full h-full overflow-visible"
                  >
                    <defs>
                      <linearGradient
                        id="balanceGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="hsl(var(--accent))"
                          stopOpacity="0.15"
                        />
                        <stop
                          offset="100%"
                          stopColor="hsl(var(--accent))"
                          stopOpacity="0"
                        />
                      </linearGradient>
                    </defs>
                    {/* Area fill */}
                    <path
                      d="M 0,60 C 35,60 55,42 90,46 C 125,50 145,62 180,50 C 215,38 240,20 275,22 C 295,23 310,14 320,10 L 320,80 L 0,80 Z"
                      fill="url(#balanceGrad)"
                    />
                    {/* Stroke */}
                    <path
                      d="M 0,60 C 35,60 55,42 90,46 C 125,50 145,62 180,50 C 215,38 240,20 275,22 C 295,23 310,14 320,10"
                      fill="none"
                      stroke="hsl(var(--accent))"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    {/* Highlight point at latest reading */}
                    <circle
                      cx="320"
                      cy="10"
                      r="3"
                      fill="hsl(var(--accent))"
                    />
                  </svg>
                </div>
              </div>

              {/* Accounts card: Header "Accounts" with + and ⋮ icons. Three rows (py-3, no dividers, text-xs, justify-between) */}
              <div className="flex-1 basis-0 rounded-lg bg-background p-3.5 border border-border shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">
                    Accounts
                  </span>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <button
                      onClick={() =>
                        addToast({
                          title: "New Treasury Account",
                          description: "Automated account provisioning initiated.",
                          type: "success",
                        })
                      }
                      className="p-1 hover:text-foreground transition-colors"
                      aria-label="Add account"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      onClick={() =>
                        addToast({
                          title: "Account Settings",
                          description: "Sweeps and yield configurations opened.",
                          type: "info",
                        })
                      }
                      className="p-1 hover:text-foreground transition-colors"
                      aria-label="More account options"
                    >
                      <MoreVertical className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                <div className="divide-y-0 flex-1 flex flex-col justify-around py-1">
                  <div className="flex items-center justify-between py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-accent/70" />
                      <span className="text-muted-foreground font-medium">
                        Credit
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      $98,125.50
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-500/70" />
                      <span className="text-muted-foreground font-medium">
                        Treasury
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      $6,750,200.00
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-amber-500/70" />
                      <span className="text-muted-foreground font-medium">
                        Operations
                      </span>
                    </div>
                    <span className="font-semibold text-foreground">
                      $1,592,864.82
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transactions table: "Recent Transactions" heading, table with columns Date/Description/Amount/Status */}
            <div className="rounded-lg bg-background p-3.5 border border-border shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-xs text-foreground">
                  Recent Transactions
                </h3>
                <button
                  onClick={() =>
                    addToast({
                      title: "Exporting Ledger",
                      description: "Downloading verified CSV of recent transactions.",
                      type: "info",
                    })
                  }
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  View all
                </button>
              </div>
              <table className="w-full text-left text-[10px]">
                <thead>
                  <tr className="border-b border-border/80 text-muted-foreground">
                    <th className="pb-1.5 font-medium">Date</th>
                    <th className="pb-1.5 font-medium">Description</th>
                    <th className="pb-1.5 font-medium text-right">Amount</th>
                    <th className="pb-1.5 font-medium text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-secondary/30 transition-colors">
                      <td className="py-2 text-muted-foreground">{tx.date}</td>
                      <td className="py-2 font-medium text-foreground">{tx.desc}</td>
                      <td
                        className={`py-2 text-right font-medium ${
                          tx.isPositive ? "text-emerald-600" : "text-foreground"
                        }`}
                      >
                        {tx.amount}
                      </td>
                      <td className="py-2 text-right">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium border ${
                            tx.status === "Pending"
                              ? "bg-amber-50 text-amber-700 border-amber-200/80"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
