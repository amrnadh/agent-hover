import type { ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Shared container card component providing consistent styling, border, and background.
 */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-slate-800 bg-slate-900/70 p-6 shadow-lg shadow-black/20 backdrop-blur-sm transition-all duration-200 hover:border-slate-700 ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;
