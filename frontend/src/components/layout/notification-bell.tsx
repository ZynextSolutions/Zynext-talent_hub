"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types";

function formatWhen(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function NotificationRow({
  item,
  onRead,
}: {
  item: Notification;
  onRead: (id: string) => void;
}) {
  const content = (
    <div className="flex flex-col gap-0.5">
      <p className={cn("text-sm leading-snug", !item.readAt && "font-medium")}>{item.title}</p>
      <p className="text-muted-foreground line-clamp-2 text-xs">{item.body}</p>
      <p className="text-muted-foreground text-[10px]">{formatWhen(item.createdAt)}</p>
    </div>
  );

  if (item.href) {
    return (
      <DropdownMenuItem
        asChild
        className="cursor-pointer items-start py-2.5"
        onSelect={() => {
          if (!item.readAt) onRead(item.id);
        }}
      >
        <Link href={item.href.replace(/^https?:\/\/[^/]+/, "") || "/dashboard"}>{content}</Link>
      </DropdownMenuItem>
    );
  }

  return (
    <DropdownMenuItem
      className="cursor-pointer items-start py-2.5"
      onSelect={() => {
        if (!item.readAt) onRead(item.id);
      }}
    >
      {content}
    </DropdownMenuItem>
  );
}

export function NotificationBell({ className }: { className?: string }) {
  const { data: unread } = useUnreadNotificationCount();
  const { data: notifications } = useNotifications({ pageSize: 8, unreadOnly: false });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const count = unread?.count ?? 0;
  const items = notifications?.items ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("relative h-9 w-9 shrink-0", className)}
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {count > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
              {count > 9 ? "9+" : count}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {count > 0 ? (
            <button
              type="button"
              className="text-muted-foreground text-xs font-normal hover:text-foreground"
              onClick={() => markAllRead.mutate()}
            >
              Mark all read
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length ? (
          items.map((item) => (
            <NotificationRow
              key={item.id}
              item={item}
              onRead={(id) => markRead.mutate(id)}
            />
          ))
        ) : (
          <div className="text-muted-foreground px-2 py-6 text-center text-sm">No notifications yet</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
