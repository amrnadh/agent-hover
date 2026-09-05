import { Card } from '../shared/Card';
import { SignupButton } from './SignupButton';

export interface PricingCardProps {
  name: string;
  price: number;
  features: string[];
  highlighted?: boolean;
}

/**
 * Subscription tier card with feature breakdown and action button.
 */
export function PricingCard({
  name,
  price,
  features,
  highlighted = false,
}: PricingCardProps) {
  return (
    <Card
      className={`relative flex flex-col justify-between ${
        highlighted
          ? 'border-indigo-500/80 bg-slate-900/90 ring-1 ring-indigo-500/50 shadow-indigo-500/10 shadow-xl'
          : 'border-slate-800'
      }`}
    >
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-flex items-center rounded-full bg-indigo-500 px-3 py-0.5 text-xs font-semibold text-white shadow">
            Most Popular
          </span>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{name}</h3>
        </div>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold tracking-tight text-white">
            ${price}
          </span>
          <span className="text-sm font-medium text-slate-400">/month</span>
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Billed annually or ${price + 5} month-to-month.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-slate-300">
          {features.map((feature, idx) => (
            <li key={idx} className="flex items-center gap-2.5">
              <svg
                className={`h-4 w-4 shrink-0 ${
                  highlighted ? 'text-indigo-400' : 'text-slate-400'
                }`}
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-8">
        <SignupButton variant={highlighted ? 'primary' : 'secondary'}>
          {highlighted ? 'Start 14-day free trial' : 'Get started'}
        </SignupButton>
      </div>
    </Card>
  );
}

export default PricingCard;
