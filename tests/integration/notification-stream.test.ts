import { describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/notifications/stream/route";
import { prisma } from "@/lib/prisma";

import { createUser, currentUser, signInAs } from "./helpers";

// The route reads the session with next-auth directly (the proxy doesn't run under /api).
vi.mock("next-auth", async () => {
  const { currentUser } = await import("./helpers");
  return {
    getServerSession: vi.fn(async () =>
      currentUser.value ? { user: { id: currentUser.value.id, sessionVersion: 0 } } : null,
    ),
  };
});

/** Reads the stream until `predicate` matches what arrived so far, then disconnects like a closed tab. */
async function readUntil(response: Response, controller: AbortController, predicate: (text: string) => boolean) {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 10_000;
  while (!predicate(text) && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  controller.abort();
  await reader.cancel().catch(() => {});
  return text;
}

function open() {
  const controller = new AbortController();
  const request = new Request("http://localhost/api/notifications/stream", { signal: controller.signal });
  return { controller, response: GET(request) };
}

describe("GET /api/notifications/stream", () => {
  it("rejects requests without a session", async () => {
    const { response } = open();
    expect((await response).status).toBe(401);
  });

  it("rejects a revoked session (password changed since)", async () => {
    const user = await createUser();
    signInAs(user);
    await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: 1 } });
    const { response } = open();
    expect((await response).status).toBe(401);
  });

  it("sends the feed right away and again when a notification arrives", async () => {
    const user = await createUser();
    const organization = await prisma.organization.create({ data: { name: "Equipo", slug: `equipo-${Date.now()}` } });
    signInAs(user);

    const { controller, response } = open();
    const res = await response;
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const feeds = (text: string) => text.split("event: feed\n").length - 1;
    const pending = readUntil(res, controller, (text) => feeds(text) >= 2);
    // Let the first feed go out, then create a notification for the next check to pick up.
    await new Promise((resolve) => setTimeout(resolve, 300));
    await prisma.notification.create({
      data: { type: "ORG_TASK_ASSIGNED", userId: currentUser.value!.id, organizationId: organization.id, taskTitle: "Portada" },
    });

    const text = await pending;
    expect(text).toMatch(/^retry: \d+/);
    const payloads = [...text.matchAll(/event: feed\ndata: (.*)\n\n/g)].map((m) => JSON.parse(m[1]));
    expect(payloads[0]).toEqual({ unreadCount: 0, items: [] });
    expect(payloads[1]).toMatchObject({ unreadCount: 1, items: [{ type: "ORG_TASK_ASSIGNED", taskTitle: "Portada" }] });
  });
});
