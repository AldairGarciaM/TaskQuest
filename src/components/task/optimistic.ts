import type { TaskDTO } from "@/lib/data/dashboard";

/** Changes shown right away while the Server Action runs (mission lists and the dashboard summary). */
export type TaskOptimisticAction =
  | { type: "toggle"; id: string; completed: boolean }
  | { type: "delete"; id: string };

export function applyTaskAction(tasks: TaskDTO[], action: TaskOptimisticAction): TaskDTO[] {
  if (action.type === "delete") return tasks.filter((task) => task.id !== action.id);
  return tasks.map((task) =>
    task.id === action.id
      ? {
          ...task,
          status: action.completed ? "COMPLETED" : "PENDING",
          completedAt: action.completed ? new Date().toISOString() : null,
        }
      : task,
  );
}
