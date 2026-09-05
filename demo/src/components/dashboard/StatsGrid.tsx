import { StatCard } from './StatCard';

/**
 * Grid layout displaying key metric summary cards.
 */
export function StatsGrid() {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard title="Revenue" value="$12,450" trend={12.5} />
      <StatCard title="Users" value="1,234" trend={-3.2} />
      <StatCard title="Orders" value="856" trend={8.1} />
    </div>
  );
}

export default StatsGrid;
