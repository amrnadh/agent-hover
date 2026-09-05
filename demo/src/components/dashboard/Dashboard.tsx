import { StatsGrid } from './StatsGrid';
import { RecentActivity } from './RecentActivity';

/**
 * Main dashboard view composing metric statistics and recent activity stream.
 */
export function Dashboard() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
          Dashboard Overview
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Monitor your key performance metrics and latest platform activities.
        </p>
      </div>

      {/* Stats Cards */}
      <section aria-label="Key Performance Indicators">
        <StatsGrid />
      </section>

      {/* Activity Section */}
      <section aria-label="Recent Activity Stream">
        <RecentActivity />
      </section>
    </div>
  );
}

export default Dashboard;
