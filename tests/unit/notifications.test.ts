import { describe, expect, it } from "vitest";

import { notificationText, timeAgo } from "@/lib/notifications/messages";

const base = { taskTitle: "Revisar portada", xp: 0, level: null, note: null, actorName: "Lucía" } as const;

describe("notificationText", () => {
  it("says who approved it and the XP earned", () => {
    expect(notificationText({ ...base, type: "ORG_TASK_APPROVED", xp: 50 })).toEqual({
      title: "¡Tarea aprobada! +50 XP",
      description: "Lucía aprobó “Revisar portada” y obtuviste 50 XP.",
    });
  });

  it("mentions a level up", () => {
    const { description } = notificationText({ ...base, type: "ORG_TASK_APPROVED", xp: 100, level: 4 });
    expect(description).toMatch(/¡Subiste a nivel 4!$/);
  });

  it("shows the reviewer's note when changes are requested", () => {
    expect(notificationText({ ...base, type: "ORG_TASK_CHANGES_REQUESTED", note: "Falta el enlace" }).description).toBe(
      "Lucía revisó “Revisar portada”: Falta el enlace",
    );
    expect(
      notificationText({ ...base, type: "ORG_TASK_CHANGES_REQUESTED", actorName: null }).description,
    ).toBe("Un admin devolvió “Revisar portada” para que la ajustes.");
  });
});

describe("notificationText for rescheduled tasks", () => {
  it("says who moved it and to which day", () => {
    expect(notificationText({ ...base, type: "ORG_TASK_RESCHEDULED", dueDate: "2026-11-05" })).toEqual({
      title: "Cambió la fecha de una tarea",
      description: "Lucía movió “Revisar portada” al jueves, 5 de noviembre.",
    });
  });
});

describe("timeAgo", () => {
  const now = new Date("2026-10-28T12:00:00Z");
  it.each([
    ["2026-10-28T11:59:30Z", "ahora"],
    ["2026-10-28T11:55:00Z", "hace 5 min"],
    ["2026-10-28T09:00:00Z", "hace 3 h"],
    ["2026-10-26T12:00:00Z", "hace 2 d"],
  ])("%s → %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
