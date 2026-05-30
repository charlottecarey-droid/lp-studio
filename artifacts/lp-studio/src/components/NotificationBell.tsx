import { useState } from "react";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { useNotifications, type NotificationItem } from "@/hooks/use-notifications";

function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function NotificationRow({
  item,
  onRead,
}: {
  item: NotificationItem;
  onRead: (id: number) => void;
}) {
  const handleClick = () => {
    if (!item.read) onRead(item.id);
  };
  const content = (
    <div className="flex gap-2.5">
      <span
        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.read ? "bg-transparent" : "bg-primary"}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        {item.title && (
          <p className={`text-sm leading-snug ${item.read ? "font-medium text-foreground/80" : "font-semibold text-foreground"}`}>
            {item.title}
          </p>
        )}
        {item.body && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
        )}
        <p className="mt-1 text-[11px] text-muted-foreground/70">{timeAgo(item.createdAt)}</p>
      </div>
    </div>
  );

  if (item.ctaUrl) {
    return (
      <a
        href={item.ctaUrl}
        onClick={handleClick}
        className="block px-4 py-3 transition-colors hover:bg-muted/60"
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full px-4 py-3 text-left transition-colors hover:bg-muted/60"
    >
      {content}
    </button>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, loading, loadItems, markRead, markAllRead } = useNotifications();

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) void loadItems();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
          title="Notifications"
          className="relative flex items-center justify-center rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          data-testid="notification-bell"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
              data-testid="notification-badge"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" sideOffset={8}>
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => void markAllRead()}
            >
              <Check className="mr-1 h-3 w-3" /> Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {loading && items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <Bell className="mx-auto mb-2 h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">You're all caught up</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <NotificationRow key={item.id} item={item} onRead={(id) => void markRead([id])} />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
