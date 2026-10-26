import TaskCard from "./TaskCard";

const tasks = [
  {
    title: "Implementar autenticación",
    description: "Configurar login y registro",
    xp: 250,
    difficulty: "Épica",
    dueDate: "24 Mayo",
  },
  {
    title: "Diseñar vista de logros",
    description: "Crear componentes y responsive",
    xp: 50,
    difficulty: "Media",
    dueDate: "18 Mayo",
  },
  {
    title: "Corregir bug de tareas",
    description: "Estado no actualiza correctamente",
    xp: 100,
    difficulty: "Difícil",
    dueDate: "20 Mayo",
  },
] as const;

export default function TaskList() {
  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <TaskCard
          key={task.title}
          {...task}
        />
      ))}
    </div>
  );
}