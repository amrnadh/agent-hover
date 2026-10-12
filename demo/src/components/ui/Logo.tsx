import { cn } from "../../lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7", className)}>
      <rect width="32" height="32" rx="8" className="fill-brand" />
      <path
        d="M9 21.5c0-7 5-12 14-12.5-.5 9-5.5 14-12.5 14L9 23.5"
        fill="none"
        className="stroke-brand-foreground"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight", className)}>
      <LogoMark />
      Sorrel
    </span>
  );
}
