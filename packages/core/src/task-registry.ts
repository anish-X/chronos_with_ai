import type { TaskDefinition } from './types.js';

export interface TaskRegistry {
  register<Input, Output>(task: TaskDefinition<Input, Output>): void;
  get(name: string): TaskDefinition<unknown, unknown> | undefined;
  list(): Array<TaskDefinition<unknown, unknown>>;
  clear(): void;
}

function createTaskRegistry(): TaskRegistry {
  const tasks = new Map<string, TaskDefinition<unknown, unknown>>();

  return {
    register(task) {
      if (tasks.has(task.name)) {
        throw new Error(`Task "${task.name}" already registered`);
      }
      tasks.set(task.name, task);
    },
    get(name) {
      return tasks.get(name);
    },
    list() {
      return Array.from(tasks.values());
    },
    clear() {
      tasks.clear();
    },
  };
}

export const taskRegistry = createTaskRegistry();