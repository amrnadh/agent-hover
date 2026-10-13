import { cn } from "../../lib/utils";

/** Hand-drawn underline for a word in a heading. Put it inside a `relative` inline wrapper. */
export function Squiggle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 20"
      preserveAspectRatio="none"
      aria-hidden="true"
      className={cn("absolute inset-x-0 -bottom-2 h-5 w-full overflow-visible", className)}
    >
      <path
        d="M4 13 C 30 4, 52 4, 74 11 S 118 19, 142 11 S 178 4, 196 9"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="6"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
