import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { getNotificationFeed, getNotificationSignature } from "@/lib/notifications/server";
import { isSessionCurrent } from "@/lib/session-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** How often the server looks for changes for this user. */
const CHECK_MS = 2_500;
/** A comment line now and then keeps proxies from closing an idle connection. */
const HEARTBEAT_MS = 20_000;
/**
 * The stream ends on its own after a few minutes and the browser reconnects (EventSource does it
 * by itself), so it fits serverless time limits and re-checks the session on every reconnect.
 */
const LIFETIME_MS = 4 * 60_000;
const RETRY_MS = 3_000;

/**
 * Server-Sent Events for the navbar bell: sends the notification feed (`event: feed`) right away
 * and again whenever it changes, so reviews and assignments show up within seconds.
 * Under /api the proxy doesn't run, so the session is checked here.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId || !(await isSessionCurrent(userId, session.user.sessionVersion))) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  const timers: ReturnType<typeof setTimeout>[] = [];
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const stopTimers = () => {
    timers.forEach(clearTimeout);
    clearInterval(heartbeat);
  };

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (chunk: string) => {
        if (!closed) controller.enqueue(encoder.encode(chunk));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        stopTimers();
        controller.close();
      };
      request.signal.addEventListener("abort", close);

      let signature = "";
      const check = async () => {
        if (closed) return;
        try {
          const next = await getNotificationSignature(userId);
          if (next !== signature) {
            signature = next;
            send(`event: feed\ndata: ${JSON.stringify(await getNotificationFeed(userId))}\n\n`);
          }
        } catch (error) {
          // A database hiccup: end the stream; the browser reconnects and starts fresh.
          console.error("notification stream check failed", error);
          close();
          return;
        }
        if (!closed) timers.push(setTimeout(check, CHECK_MS));
      };

      send(`retry: ${RETRY_MS}\n\n`);
      await check();
      heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      timers.push(setTimeout(close, LIFETIME_MS));
    },
    cancel() {
      closed = true;
      stopTimers();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Tell nginx-style proxies not to buffer the stream.
      "X-Accel-Buffering": "no",
    },
  });
}
