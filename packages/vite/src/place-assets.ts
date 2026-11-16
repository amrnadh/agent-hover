import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

/**
 * Place: assets you drop on the page are staged in .agent-hover/place/ until an agent copies them into the project.
 * Staging (not public/) keeps them out of git, the dev server's watcher and Undo checkpoints: the agent copies the
 * file after it claims the task, so the checkpoint sees it as new and Undo removes it.
 */

export const PLACE_DIR = path.join('.agent-hover', 'place');
export const PLACE_MAX_BYTES = 50 * 1024 * 1024;

export type PlaceMime = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif' | 'image/svg+xml' | 'video/mp4' | 'video/webm';

export const PLACE_EXT: Record<PlaceMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
};

const startsWith = (buf: Uint8Array, bytes: number[], offset = 0) =>
  buf.length >= offset + bytes.length && bytes.every((b, i) => buf[offset + i] === b);

const ascii = (buf: Uint8Array, start: number, end: number) => String.fromCharCode(...buf.subarray(start, end));

/** What a file really is, from its first bytes (never from its name or the browser's claim). Null when not allowed. */
export function sniffPlaceMime(buf: Uint8Array): PlaceMime | null {
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'image/gif';
  if (buf.length >= 12 && ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return 'image/webp';
  if (buf.length >= 12 && ascii(buf, 4, 8) === 'ftyp') return 'video/mp4';
  if (startsWith(buf, [0x1a, 0x45, 0xdf, 0xa3])) return 'video/webm';
  // SVG is text: allow an optional BOM, XML declaration, comments and doctype before the <svg> root.
  const head = new TextDecoder('utf-8', { fatal: false }).decode(buf.subarray(0, 4096)).replace(/^﻿/, '');
  const rest = head
    .replace(/^\s*<\?xml[^>]*\?>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .replace(/^\s*<!DOCTYPE[^>]*>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '');
  if (/^\s*<svg[\s>]/i.test(rest)) return 'image/svg+xml';
  return null;
}

export interface StagedAsset {
  id: string;
  /** Project-relative, forward slashes: what goes in the prompt. */
  path: string;
  mime: PlaceMime;
  bytes: number;
}

export async function stageAsset(projectRoot: string, buf: Uint8Array): Promise<StagedAsset> {
  const mime = sniffPlaceMime(buf);
  if (!mime) throw Object.assign(new Error('Not a supported image or video (PNG, JPG, WebP, GIF, SVG, MP4, WebM)'), { status: 415 });
  if (buf.length > PLACE_MAX_BYTES) throw Object.assign(new Error('File is larger than 50 MB'), { status: 413 });
  const id = randomUUID().slice(0, 8);
  const rel = path.join(PLACE_DIR, `${id}.${PLACE_EXT[mime]}`);
  const abs = path.join(projectRoot, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buf);
  return { id, path: rel.split(path.sep).join('/'), mime, bytes: buf.length };
}

/**
 * Removes staged assets no task refers to any more. Assets younger than `graceMs` stay, so one you dropped but
 * haven't sent yet survives a tidy.
 */
export async function sweepAssets(projectRoot: string, inUse: Set<string>, now = Date.now(), graceMs = 60 * 60 * 1000): Promise<string[]> {
  const dir = path.join(projectRoot, PLACE_DIR);
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return [];
  }
  const removed: string[] = [];
  for (const name of names) {
    const rel = `${PLACE_DIR.split(path.sep).join('/')}/${name}`;
    if (inUse.has(rel)) continue;
    const abs = path.join(dir, name);
    try {
      const st = await fs.stat(abs);
      if (!st.isFile() || now - st.mtimeMs < graceMs) continue;
      await fs.rm(abs, { force: true });
      removed.push(rel);
    } catch {}
  }
  return removed;
}
