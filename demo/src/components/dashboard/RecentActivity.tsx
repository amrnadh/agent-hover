import { Card } from '../shared/Card';
import { ActivityItem } from './ActivityItem';

interface ActivityRecord {
  id: string;
  user: string;
  action: string;
  time: string;
}

const activities: ActivityRecord[] = [
  {
    id: '1',
    user: 'Sarah Connor',
    action: 'upgraded subscription to Enterprise tier',
    time: '2m ago',
  },
  {
    id: '2',
    user: 'Michael Scott',
    action: 'created a new API token "prod-crawler"',
    time: '14m ago',
  },
  {
    id: '3',
    user: 'Elena Rostova',
    action: 'deployed project v1.4.2 to production',
    time: '1h ago',
  },
  {
    id: '4',
    user: 'David Kim',
    action: 'invited 3 new team members',
    time: '3h ago',
  },
  {
    id: '5',
    user: 'Rachel Green',
    action: 'integrated GitHub webhooks',
    time: '5h ago',
  },
];

/**
 * List container component showing recent team or application events.
 */
export function RecentActivity() {
  return (
    <Card className="p-0 overflow-hidden">
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-white">Recent Activity</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time feed of events across all workspaces
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Live
        </span>
      </div>
      <div className="p-2 divide-y divide-slate-800/40">
        {activities.map((item) => (
          <ActivityItem
            key={item.id}
            user={item.user}
            action={item.action}
            time={item.time}
          />
        ))}
      </div>
    </Card>
  );
}

export default RecentActivity;
