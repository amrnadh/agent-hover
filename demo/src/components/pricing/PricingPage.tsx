import { PricingCard } from './PricingCard';

/**
 * Pricing plan selection page showcasing available tiers and features.
 */
export function PricingPage() {
  const plans = [
    {
      name: 'Starter',
      price: 19,
      highlighted: false,
      features: [
        'Up to 5 team members',
        'Basic component telemetry',
        '30-day event history',
        'Community support',
      ],
    },
    {
      name: 'Pro',
      price: 49,
      highlighted: true,
      features: [
        'Up to 25 team members',
        'Advanced inspector & AST overlay',
        '1-year event history',
        'Priority email support',
        'Custom webhooks & integrations',
      ],
    },
    {
      name: 'Enterprise',
      price: 99,
      highlighted: false,
      features: [
        'Unlimited team members',
        'Full MCP server bridge',
        'Unlimited historical audit log',
        'Dedicated 24/7 support SLA',
        'Custom SSO & SAML auth',
      ],
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Supercharge your development workflow with AI-driven component inspection
          and instant code navigation.
        </p>
      </div>

      {/* Pricing Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-6xl mx-auto pt-4">
        {plans.map((plan) => (
          <PricingCard
            key={plan.name}
            name={plan.name}
            price={plan.price}
            features={plan.features}
            highlighted={plan.highlighted}
          />
        ))}
      </div>
    </div>
  );
}

export default PricingPage;
