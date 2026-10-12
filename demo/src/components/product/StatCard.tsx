import { cn } from "../../lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "positive" | "negative";
}

export function StatCard({ label, value, detail, tone = "default" }: StatCardProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p
        className={cn(
          "mt-1 text-xs",
          tone === "positive" && "text-brand",
          tone === "negative" && "text-danger",
          tone === "default" && "text-muted-foreground",
        )}
      >
        {detail}
      </p>
    </div>
  );
}
