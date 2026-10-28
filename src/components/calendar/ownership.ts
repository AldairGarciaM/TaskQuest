import type { CalendarOrgTask, CalendarPerson } from "@/lib/data/calendar";

export function personName(person: CalendarPerson, userId: string) {
  return person.userId === userId ? "ti" : `${person.firstName} ${person.lastName}`;
}

/** "Asignada a …" while the task is still open, "Realizada por …" once it's done. */
export function ownership(task: CalendarOrgTask, userId: string): string {
  if (task.status === "COMPLETED") {
    const by = task.completedBy ?? task.assignee;
    return by ? `Realizada por ${personName(by, userId)}` : "Realizada";
  }
  return task.assignee ? `Asignada a ${personName(task.assignee, userId)}` : "Libre: nadie la ha tomado";
}
