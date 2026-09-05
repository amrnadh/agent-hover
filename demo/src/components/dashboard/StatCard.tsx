import { Card } from '../shared/Card';

export interface StatCardProps {
  title: string;
  value: string;
  trend: number;
}

/**
 * Metric card displaying a headline stat with percentage trend indicator.
 */
export function StatCard({ title, value, trend }: StatCardProps) {
  const isPositive = trend >= 0;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <span className="text-sm font-medium text-slate-400">{title}</span>
        <div className="mt-2 text-3xl font-bold tracking-tight text-white">
          {value}
        </div>
      </div>
      <div className="mt-4 flex items-center text-xs">
        <span
          className={`inline-flex items-center gap-1 font-medium px-2 py-0.5 rounded-full ${
            isPositive
              ? 'bg-emerald-500/10 text-emerald-400'
              : 'bg-rose-500/10 text-rose-400'
          }`}
        >
          {isPositive ? (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 17a.75.75 0 01-.75-.75V5.612L5.29 9.77a.75.75 0 01-1.08-1.04l5.25-5.5a.75.75 0 011.08 0l5.25 5.5a.75.75 0 11-1.08 1.04l-3.96-4.158V16.25A.75.75 0 0110 17z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                clipRule="evenodd"
              />
            </svg>
          )}
          {isPositive ? `+${trend}%` : `${trend}%`}
        </span>
        <span className="ml-2 text-slate-500">from last month</span>
      </div>
    </Card>
  );
}

export default StatCard;
