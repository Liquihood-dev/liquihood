import React from 'react';
import { useProtocol } from '@/hooks/use-protocol';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, TrendingUp, X, Bell } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationsPanel({ open, onClose }: Props) {
  const { notifications, markNotificationRead } = useProtocol();

  if (!open) return null;

  const icons: Record<string, React.ReactNode> = {
    n1: <AlertTriangle className="h-4 w-4 text-yellow-400" />,
    n2: <Clock className="h-4 w-4 text-primary" />,
    n3: <TrendingUp className="h-4 w-4 text-blue-400" />,
  };

  const unread = notifications.filter(n => !n.read).length;

  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const days  = Math.floor(diff / 86_400_000);
    const hours = Math.floor(diff / 3_600_000);
    if (days > 0)  return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    return 'Just now';
  };

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className="md:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/*
        Mobile  : fixed, centered horizontally, below header (top-[60px])
        Desktop : absolute, right-aligned dropdown
      */}
      <div className={cn(
        // shared
        "z-50 bg-card border border-border rounded-xl shadow-2xl shadow-black/60 overflow-hidden",
        "animate-in slide-in-from-top-2 fade-in duration-150",
        // mobile
        "fixed left-3 right-3 top-[68px]",
        // desktop override
        "md:fixed md:left-auto md:right-4 md:top-[68px] md:w-80",
      )}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-sm">Notifications</span>
            {unread > 0 && (
              <span className="h-4 w-4 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
                {unread}
              </span>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="divide-y divide-border/50 max-h-[60vh] md:max-h-80 overflow-y-auto">
          {notifications.length === 0 && (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
              No notifications yet
            </div>
          )}
          {notifications.map(n => (
            <div
              key={n.id}
              className={cn(
                'px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors',
                !n.read && 'bg-primary/5'
              )}
              onClick={() => { markNotificationRead(n.id); }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  {icons[n.id] ?? <Bell className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-semibold leading-tight', !n.read && 'text-foreground')}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] font-mono text-muted-foreground/60 mt-1">{formatTime(n.time)}</p>
                </div>
                {!n.read && <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1 shrink-0" />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
