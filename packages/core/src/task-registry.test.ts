import { describe, it, expect, beforeEach } from 'vitest';
import { taskRegistry } from './task-registry.js';
import type { TaskDefinition } from './types.js';
import { z } from 'zod';

describe('TaskRegistry', () => {
  beforeEach(() => {
    taskRegistry.clear();
  });

  it('registers and retrieves a task', () => {
    const testTask: TaskDefinition<{ x: number }, { y: number }> = {
      name: 'test_task',
      description: 'A test task',
      inputSchema: z.object({ x: z.number() }),
      outputSchema: z.object({ y: z.number() }),
      async execute(input) {
        return { y: input.x * 2 };
      },
    };

    taskRegistry.register(testTask);
    const retrieved = taskRegistry.get('test_task');

    expect(retrieved).toBeDefined();
    expect(retrieved?.name).toBe('test_task');
    expect(retrieved?.description).toBe('A test task');
  });

  it('returns undefined for unknown task', () => {
    const retrieved = taskRegistry.get('unknown_task');
    expect(retrieved).toBeUndefined();
  });

  it('lists all registered tasks', () => {
    const task1: TaskDefinition = {
      name: 'task1',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      async execute() {
        return {};
      },
    };
    const task2: TaskDefinition = {
      name: 'task2',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      async execute() {
        return {};
      },
    };

    taskRegistry.register(task1);
    taskRegistry.register(task2);

    const tasks = taskRegistry.list();
    expect(tasks).toHaveLength(2);
    expect(tasks.map(t => t.name).sort()).toEqual(['task1', 'task2']);
  });

  it('throws when registering duplicate task name', () => {
    const task: TaskDefinition = {
      name: 'duplicate',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      async execute() {
        return {};
      },
    };

    taskRegistry.register(task);
    expect(() => taskRegistry.register(task)).toThrow('already registered');
  });
});