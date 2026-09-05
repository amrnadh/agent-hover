export interface ActivityItemProps {
  user: string;
  action: string;
  time: string;
}

/**
 * Single activity log entry displaying user, action performed, and relative timestamp.
 */
export function ActivityItem({ user, action, time }: ActivityItemProps) {
  // Get 1 or 2 letter initials from user name
  const initials = user
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center justify-between py-3.5 px-4 rounded-lg transition-colors hover:bg-slate-800/40">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-400 font-semibold text-xs border border-indigo-500/30">
          {initials}
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200">
            <span className="font-semibold text-white">{user}</span> {action}
          </p>
        </div>
      </div>
      <time className="text-xs text-slate-500 font-mono whitespace-nowrap ml-4">
        {time}
      </time>
    </div>
  );
}

export default ActivityItem;
