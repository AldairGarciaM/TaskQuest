"use client";

import { Popover } from "@base-ui/react/popover";
import { Bell, CircleCheck, MessageSquareWarning } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { fetchNotifications, markNotificationsRead } from "@/app/actions/notifications";
import { notificationText, timeAgo } from "@/lib/notifications/messages";
import type { NotificationDTO, NotificationFeed } from "@/lib/notifications/server";
import { cn } from "@/lib/utils";

const POLL_MS = 30_000;
/** More new notifications than this at once collapse into a single toast. */
const MAX_TOASTS = 3;

interface NotificationBellProps {
  userId: string;
  initialFeed: NotificationFeed;
}

/** Newest notification already toasted, per user, so a reload doesn't repeat the toasts. */
function storageKey(userId: string) {
  return `taskquest:notified-until:${userId}`;
}

function readNotifiedUntil(userId: string): string | null {
  try {
    return window.localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
}

function writeNotifiedUntil(userId: string, iso: string) {
  try {
    window.localStorage.setItem(storageKey(userId), iso);
  } catch {
    // Private mode or blocked storage: toasts may repeat on reload, nothing else breaks.
  }
}

function showToast(n: NotificationDTO) {
  const { title, description } = notificationText(n);
  if (n.type === "ORG_TASK_APPROVED") toast.success(title, { description });
  else toast(title, { description });
}

export default function NotificationBell({ userId, initialFeed }: NotificationBellProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [feed, setFeed] = useState(initialFeed);
  const [source, setSource] = useState(initialFeed);
  const [open, setOpen] = useState(false);
  /** Ids that were unread when the panel opened; they stay highlighted until it closes. */
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());
  const notifiedUntil = useRef<string | null>(null);
  const latestFeed = useRef(initialFeed);

  // A server render (navigation, revalidation) brings newer data than the last poll.
  if (source !== initialFeed) {
    setSource(initialFeed);
    setFeed(initialFeed);
  }

  useEffect(() => {
    latestFeed.current = feed;
  }, [feed]);

  // Toast unread notifications that arrived since the last toast.
  useEffect(() => {
    const since = notifiedUntil.current ?? readNotifiedUntil(userId);
    const unseen = feed.items.filter((n) => !n.read && (!since || n.createdAt > since));
    if (unseen.length === 0) return;

    if (unseen.length > MAX_TOASTS) {
      toast(`Tienes ${unseen.length} notificaciones nuevas`, { description: "Ábrelas desde la campana." });
    } else {
      [...unseen].reverse().forEach(showToast);
    }
    notifiedUntil.current = unseen[0].createdAt;
    writeNotifiedUntil(userId, unseen[0].createdAt);
  }, [feed, userId]);

  // Poll while the tab is visible so a review shows up without reloading.
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await fetchNotifications();
        if (cancelled) return;
        const newest = latestFeed.current.items[0]?.createdAt ?? "";
        setFeed(next);
        // An approval changed my XP and level: re-render the server parts (hero, boards).
        if (next.items.some((n) => n.createdAt > newest)) router.refresh();
      } catch {
        // Offline or signed out: try again on the next tick.
      }
    }

    const timer = window.setInterval(poll, POLL_MS);
    document.addEventListener("visibilitychange", poll);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [router]);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFresh(new Set());
      return;
    }
    if (feed.unreadCount === 0) return;

    setFresh(new Set(feed.items.filter((n) => !n.read).map((n) => n.id)));
    setFeed((current) => ({ unreadCount: 0, items: current.items.map((n) => ({ ...n, read: true })) }));
    markNotificationsRead().catch(() => {
      // Still unread on the server; the next poll restores the badge.
    });
  }

  const unread = feed.unreadCount;

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger
        aria-label={unread > 0 ? `Notificaciones (${unread} sin leer)` : "Notificaciones"}
        className="relative rounded-full bg-slate-800 p-3 transition-[background-color,transform] duration-150 hover:bg-slate-700 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:outline-none active:scale-[0.97] data-[popup-open]:bg-slate-700"
      >
        <Bell size={18} />
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { scale: 0.4, opacity: 0 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0.35 }}
              className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[11px] leading-none font-bold text-slate-950 tabular-nums ring-2 ring-slate-900"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={10} className="z-50">
          <Popover.Popup className="w-[min(22rem,calc(100vw-2rem))] origin-(--transform-origin) rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-xl shadow-black/40 transition-[opacity,transform] duration-150 ease-out outline-none data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0 motion-reduce:transition-opacity motion-reduce:data-[ending-style]:scale-100 motion-reduce:data-[starting-style]:scale-100">
            <div className="flex items-baseline justify-between border-b border-slate-800 px-4 py-3">
              <Popover.Title className="text-sm font-semibold">Notificaciones</Popover.Title>
              {fresh.size > 0 && (
                <span className="text-xs text-amber-300">
                  {fresh.size === 1 ? "1 nueva" : `${fresh.size} nuevas`}
                </span>
              )}
            </div>

            {feed.items.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <Bell size={22} className="mx-auto text-slate-600" />
                <p className="mt-3 text-sm text-slate-300">Todo tranquilo por aquí</p>
                <p className="mt-1 text-xs text-slate-500">
                  Te avisaremos cuando revisen tus tareas de equipo.
                </p>
              </div>
            ) : (
              <ul className="max-h-96 overflow-y-auto py-1">
                {feed.items.map((n) => (
                  <NotificationRow key={n.id} notification={n} isNew={fresh.has(n.id)} onNavigate={() => setOpen(false)} />
                ))}
              </ul>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface NotificationRowProps {
  notification: NotificationDTO;
  isNew: boolean;
  onNavigate: () => void;
}

function NotificationRow({ notification: n, isNew, onNavigate }: NotificationRowProps) {
  const approved = n.type === "ORG_TASK_APPROVED";
  const { title, description } = notificationText(n);
  const Icon = approved ? CircleCheck : MessageSquareWarning;

  return (
    <li>
      <Link
        href={`/organizaciones/${n.organization.slug}`}
        onClick={onNavigate}
        className={cn(
          "flex gap-3 px-4 py-3 transition-colors hover:bg-slate-800/70 focus-visible:bg-slate-800/70 focus-visible:outline-none",
          isNew && "bg-violet-500/[0.07]",
        )}
      >
        <span
          className={cn(
            "mt-0.5 grid size-8 shrink-0 place-items-center rounded-full",
            approved ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300",
          )}
        >
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-slate-100">{title}</span>
            {isNew && (
              <span className="size-1.5 shrink-0 rounded-full bg-violet-400">
                <span className="sr-only">Nueva</span>
              </span>
            )}
          </span>
          <span className="mt-0.5 line-clamp-2 block text-xs text-slate-400">{description}</span>
          <span className="mt-1 block text-[11px] text-slate-500">
            {n.organization.name} · {timeAgo(n.createdAt)}
          </span>
        </span>
      </Link>
    </li>
  );
}
