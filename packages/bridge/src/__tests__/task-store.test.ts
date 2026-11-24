import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { TaskStore } from '../task-store.js';

describe('TaskStore State Machine and Persistence (P1-03)', () => {
  let tempDir: string;
  let store: TaskStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'ah-task-store-test-'));
    store = new TaskStore(tempDir);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('creates task with default queued status, timestamps, and expiration', async () => {
    const task = await store.createTask({
      instruction: 'Make button blue',
      target: { component: 'Button', file: 'src/Button.tsx' },
    });

    expect(task.id).toBeDefined();
    expect(task.status).toBe('queued');
    expect(task.createdAt).toBeDefined();
    expect(task.expiresAt).toBeDefined();
    expect(new Date(task.expiresAt).getTime()).toBeGreaterThan(new Date(task.createdAt).getTime());

    const fetched = store.getTask(task.id);
    expect(fetched).toEqual(task);
  });

  it('handles legal lifecycle transitions: queued -> delivered -> in_progress -> done', async () => {
    const task = await store.createTask({ instruction: 'Fix header' });
    expect(task.status).toBe('queued');

    // 1. Mark delivered
    const delivered = await store.markDelivered(task.id);
    expect(delivered.status).toBe('delivered');

    // 2. Claim
    const claimed = await store.claimTask(task.id, { client: 'claude-code' });
    expect(claimed.status).toBe('in_progress');
    expect(claimed.claimedBy).toBe('claude-code');

    // 3. Complete (done)
    const completed = await store.completeTask(task.id, {
      status: 'done',
      summary: 'Changed border color to blue',
      filesChanged: ['src/Header.tsx'],
    });
    expect(completed.status).toBe('done');
    expect(completed.result?.summary).toBe('Changed border color to blue');
    expect(completed.result?.filesChanged).toEqual(['src/Header.tsx']);
  });

  it('handles legal completion to failed status', async () => {
    const task = await store.createTask({ instruction: 'Refactor modal' });
    await store.claimTask(task.id, { client: 'cursor' });

    const failed = await store.completeTask(task.id, {
      status: 'failed',
      error: 'Syntax error during compilation',
    });
    expect(failed.status).toBe('failed');
    expect(failed.result?.error).toBe('Syntax error during compilation');
  });

  it('handles user cancellation of queued and delivered tasks', async () => {
    // Queued cancellation
    const task1 = await store.createTask({ instruction: 'Task 1' });
    const cancelled1 = await store.cancelTask(task1.id);
    expect(cancelled1.status).toBe('cancelled');

    // Delivered cancellation
    const task2 = await store.createTask({ instruction: 'Task 2' });
    await store.markDelivered(task2.id);
    const cancelled2 = await store.cancelTask(task2.id);
    expect(cancelled2.status).toBe('cancelled');
  });

  it('rejects illegal state transitions', async () => {
    const task = await store.createTask({ instruction: 'Illegal transition test' });

    // Cannot complete directly from queued
    await expect(store.completeTask(task.id, { status: 'done' })).rejects.toThrow(/must be in_progress/);

    // Claim task
    await store.claimTask(task.id, { client: 'agent' });

    // Cannot cancel in_progress task
    await expect(store.cancelTask(task.id)).rejects.toThrow(/only queued\/delivered can be cancelled/);

    // Complete task
    await store.completeTask(task.id, { status: 'done' });

    // Cannot claim or cancel a done task
    await expect(store.claimTask(task.id, { client: 'other' })).rejects.toThrow(/Cannot claim task in 'done' state/);
    await expect(store.cancelTask(task.id)).rejects.toThrow(/Cannot cancel task in 'done' state/);
    await expect(store.completeTask(task.id, { status: 'done' })).rejects.toThrow(/must be in_progress/);
  });

  it('supersedes older tasks with matching supersedesKey', async () => {
    const key = 'component-context:src/Button.tsx:Button';

    const firstTask = await store.createTask({
      instruction: 'First instruction',
      supersedesKey: key,
    });
    expect(firstTask.status).toBe('queued');

    const secondTask = await store.createTask({
      instruction: 'Second instruction',
      supersedesKey: key,
    });

    const updatedFirst = store.getTask(firstTask.id);
    expect(updatedFirst?.status).toBe('superseded');
    expect(secondTask.status).toBe('queued');
  });

  it('persists tasks across server restarts', async () => {
    const task = await store.createTask({
      instruction: 'Persisted task',
      target: { component: 'Sidebar' },
    });
    await store.markDelivered(task.id);

    // Create fresh instance pointing at same projectRoot
    const newStore = new TaskStore(tempDir);
    const restored = newStore.getTask(task.id);

    expect(restored).toBeDefined();
    expect(restored?.instruction).toBe('Persisted task');
    expect(restored?.status).toBe('delivered');
  });

  it('expires tasks after TTL elapsed', async () => {
    const task = await store.createTask({
      instruction: 'Quick expiry task',
      ttlMs: 50, // 50ms TTL
    });

    expect(task.status).toBe('queued');

    // Wait 70ms
    await new Promise((resolve) => setTimeout(resolve, 70));

    store.expireOldTasks();
    const expired = store.getTask(task.id);
    expect(expired?.status).toBe('expired');
  });

  it('tidies history after a week, keeping changes nobody has kept or undone', async () => {
    const week = 7 * 24 * 60 * 60 * 1000;
    const make = async (status: 'done' | 'failed' | 'cancel', files: string[] = []) => {
      const t = await store.createTask({ instruction: status });
      if (status === 'cancel') return store.cancelTask(t.id);
      await store.claimTask(t.id, { client: 'agent' });
      return store.completeTask(t.id, { status, filesChanged: files });
    };
    const cancelled = await make('cancel');
    const failed = await make('failed');
    const answered = await make('done');
    const unreviewed = await make('done', ['src/a.tsx']);
    const waiting = await store.createTask({ instruction: 'waiting' });
    expect(await store.pruneHistory()).toEqual([]);
    const removed = await store.pruneHistory(Date.now() + week + 1000);
    expect(removed.sort()).toEqual([cancelled.id, failed.id, answered.id].sort());
    expect(store.getTask(unreviewed.id)).toBeDefined();
    expect(store.getTask(waiting.id)).toBeDefined();
  });
});
