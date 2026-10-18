import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import type {
  AgentTask,
  TaskStatus,
  TaskType,
  AgentTaskTarget,
  AgentTaskPayload,
  AgentTaskResult,
  Intent,
  Scope,
  TaskReview,
} from '@agent-hover/core';
import { BRAND } from '@agent-hover/core';

export interface CreateTaskOptions {
  id?: string;
  type?: TaskType;
  intent?: Intent;
  scope?: Scope;
  instruction?: string;
  target?: AgentTaskTarget;
  payload?: AgentTaskPayload;
  supersedesKey?: string;
  tokenEstimate?: number;
  ttlMs?: number;
  /** Send to one agent by its MCP client name. */
  assignee?: string;
}

export interface ClaimTaskOptions {
  client: string;
}

export interface CompleteTaskOptions {
  status: 'done' | 'failed';
  summary?: string;
  filesChanged?: string[];
  error?: string;
}

export class TaskStore extends EventEmitter {
  private tasks: Map<string, AgentTask> = new Map();
  private readonly MAX_TASKS = 200;
  private readonly DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private tasksFilePath: string;

  constructor(private projectRoot: string) {
    super();
    this.tasksFilePath = path.join(this.projectRoot, BRAND.dataDir, 'tasks.json');
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (existsSync(this.tasksFilePath)) {
        const raw = readFileSync(this.tasksFilePath, 'utf-8');
        const list: AgentTask[] = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const task of list) {
            this.tasks.set(task.id, task);
          }
        }
      }
    } catch (err) {
      // Corrupt file or read failure; start empty
    }
    this.expireOldTasks();
  }

  private async saveToDisk(): Promise<void> {
    try {
      const dir = path.dirname(this.tasksFilePath);
      await fs.mkdir(dir, { recursive: true });

      const taskList = Array.from(this.tasks.values())
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, this.MAX_TASKS);

      const json = JSON.stringify(taskList, null, 2);
      const tmpFile = `${this.tasksFilePath}.tmp.${process.pid}.${Date.now()}`;
      await fs.writeFile(tmpFile, json, 'utf-8');
      await fs.rename(tmpFile, this.tasksFilePath);
    } catch (err) {
      console.error('[agent-hover] Failed to save tasks to disk:', err);
    }
  }

  public expireOldTasks(): void {
    const now = Date.now();
    for (const task of this.tasks.values()) {
      if (!this.isTerminal(task.status) && new Date(task.expiresAt).getTime() <= now) {
        task.status = 'expired';
        task.updatedAt = new Date().toISOString();
        this.emit('task:updated', task);
      }
    }
  }

  public isTerminal(status: TaskStatus): boolean {
    return ['done', 'failed', 'cancelled', 'expired', 'superseded'].includes(status);
  }

  public async createTask(options: CreateTaskOptions): Promise<AgentTask> {
    this.expireOldTasks();

    const now = new Date();
    const ttlMs = options.ttlMs || this.DEFAULT_TTL_MS;
    const expiresAt = new Date(now.getTime() + ttlMs).toISOString();

    const id = options.id || `task_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const supersedesKey = options.supersedesKey;

    // Deduplication via supersedesKey: supersede earlier queued or delivered tasks
    if (supersedesKey) {
      for (const existing of this.tasks.values()) {
        if (
          existing.supersedesKey === supersedesKey &&
          (existing.status === 'queued' || existing.status === 'delivered')
        ) {
          existing.status = 'superseded';
          existing.updatedAt = now.toISOString();
          this.emit('task:updated', existing);
        }
      }
    }

    const task: AgentTask = {
      id,
      type: options.type || 'component-context',
      status: 'queued',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      expiresAt,
      supersedesKey,
      intent: options.intent || 'general',
      scope: options.scope || 'unspecified',
      instruction: options.instruction,
      target: options.target || {},
      payload: options.payload || {},
      tokenEstimate: options.tokenEstimate,
      ...(typeof options.assignee === 'string' && options.assignee ? { assignee: options.assignee } : {}),
    };

    this.tasks.set(id, task);

    // Prune if over MAX_TASKS
    if (this.tasks.size > this.MAX_TASKS) {
      const oldestId = Array.from(this.tasks.values())
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0]?.id;
      if (oldestId) {
        this.tasks.delete(oldestId);
      }
    }

    await this.saveToDisk();
    this.emit('task:created', task);
    return task;
  }

  public getTask(id: string): AgentTask | undefined {
    this.expireOldTasks();
    return this.tasks.get(id);
  }

  public listTasks(filter?: { status?: TaskStatus[]; limit?: number }): AgentTask[] {
    this.expireOldTasks();

    let list = Array.from(this.tasks.values());

    if (filter?.status && filter.status.length > 0) {
      const allowed = new Set(filter.status);
      list = list.filter((t) => allowed.has(t.status));
    }

    list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (filter?.limit && filter.limit > 0) {
      list = list.slice(0, filter.limit);
    }

    return list;
  }

  public async markDelivered(id: string): Promise<AgentTask> {
    this.expireOldTasks();
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task '${id}' not found`);
    }

    if (task.status === 'queued') {
      task.status = 'delivered';
      task.updatedAt = new Date().toISOString();
      await this.saveToDisk();
      this.emit('task:updated', task);
    }

    return task;
  }

  public async claimTask(id: string, options: ClaimTaskOptions): Promise<AgentTask> {
    this.expireOldTasks();
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task '${id}' not found`);
    }

    if (task.status !== 'queued' && task.status !== 'delivered') {
      throw new Error(`Cannot claim task in '${task.status}' state`);
    }

    task.status = 'in_progress';
    task.claimedBy = options.client;
    task.updatedAt = new Date().toISOString();

    await this.saveToDisk();
    this.emit('task:updated', task);
    return task;
  }

  public async completeTask(id: string, options: CompleteTaskOptions): Promise<AgentTask> {
    this.expireOldTasks();
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task '${id}' not found`);
    }

    if (task.status !== 'in_progress') {
      throw new Error(`Cannot complete task in '${task.status}' state (must be in_progress)`);
    }

    task.status = options.status;
    task.updatedAt = new Date().toISOString();
    task.result = {
      summary: options.summary,
      filesChanged: options.filesChanged,
      error: options.error,
    };

    await this.saveToDisk();
    this.emit('task:updated', task);
    return task;
  }

  /** Attach a checkpoint (taken at claim) and, when the agent did not list files, the files git saw change. */
  public async annotate(id: string, data: { checkpointId?: string; filesChanged?: string[] }): Promise<AgentTask | undefined> {
    const task = this.tasks.get(id);
    if (!task) return undefined;
    if (data.checkpointId) task.checkpointId = data.checkpointId;
    if (data.filesChanged && task.result && !(task.result.filesChanged && task.result.filesChanged.length)) {
      task.result.filesChanged = data.filesChanged;
    }
    task.updatedAt = new Date().toISOString();
    await this.saveToDisk();
    this.emit('task:updated', task);
    return task;
  }

  /** Record your review of a finished task. Only a done task's change can be reviewed. */
  public async review(id: string, review: Omit<TaskReview, 'at'>): Promise<AgentTask> {
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task '${id}' not found`);
    }
    if (task.status !== 'done') {
      throw new Error(`Cannot review a task in '${task.status}' state (must be done)`);
    }
    task.review = { ...review, at: new Date().toISOString() };
    task.updatedAt = task.review.at;
    await this.saveToDisk();
    this.emit('task:updated', task);
    return task;
  }

  /**
   * Remove tasks from the list. A task an agent is working on can't be removed, and one that is waiting is
   * cancelled first. Returns the ids that were removed.
   */
  public async removeTasks(ids: string[]): Promise<string[]> {
    const removed: string[] = [];
    for (const id of ids) {
      const task = this.tasks.get(id);
      if (!task) continue;
      if (task.status === 'in_progress') throw new Error('The agent is working on this task; it can be removed once it finishes');
      if (task.status === 'queued' || task.status === 'delivered') throw new Error('Cancel the task before removing it');
      this.tasks.delete(id);
      removed.push(id);
    }
    if (removed.length) {
      await this.saveToDisk();
      this.emit('task:removed', removed);
    }
    return removed;
  }

  public async cancelTask(id: string): Promise<AgentTask> {
    this.expireOldTasks();
    const task = this.tasks.get(id);
    if (!task) {
      throw new Error(`Task '${id}' not found`);
    }

    if (task.status !== 'queued' && task.status !== 'delivered') {
      throw new Error(`Cannot cancel task in '${task.status}' state (only queued/delivered can be cancelled)`);
    }

    task.status = 'cancelled';
    task.updatedAt = new Date().toISOString();

    await this.saveToDisk();
    this.emit('task:updated', task);
    return task;
  }

  public getSnapshot(): AgentTask[] {
    this.expireOldTasks();
    return Array.from(this.tasks.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }
}
