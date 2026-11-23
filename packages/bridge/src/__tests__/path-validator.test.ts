import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { validateSafePath } from '../path-validator.js';

describe('path-validator (F-08)', () => {
  let testRoot: string;
  let outsideDir: string;

  beforeAll(() => {
    testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-path-test-root-'));
    outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ah-path-test-outside-'));

    // Create standard project structure
    fs.mkdirSync(path.join(testRoot, 'src', 'components'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, '.agent-hover', 'screenshots'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, 'node_modules', 'some-pkg'), { recursive: true });
    fs.mkdirSync(path.join(testRoot, '.git'), { recursive: true });

    // Create test files
    fs.writeFileSync(path.join(testRoot, 'src', 'App.tsx'), 'export const App = () => null;');
    fs.writeFileSync(path.join(testRoot, '.agent-hover', 'screenshots', 'shot.png'), 'image-bytes');
    fs.writeFileSync(path.join(testRoot, '.env'), 'SECRET=123');
    fs.writeFileSync(path.join(testRoot, 'node_modules', 'some-pkg', 'index.js'), 'module.exports = {};');
    fs.writeFileSync(path.join(testRoot, '.git', 'config'), '[core]');

    // Create outside file
    fs.writeFileSync(path.join(outsideDir, 'secret.txt'), 'classified data');

    // Create symlinks
    try {
      // Symlink pointing outside
      fs.symlinkSync(
        path.join(outsideDir, 'secret.txt'),
        path.join(testRoot, 'src', 'escaped-link.txt')
      );
      // Symlink pointing inside
      fs.symlinkSync(
        path.join(testRoot, 'src', 'App.tsx'),
        path.join(testRoot, 'src', 'valid-link.tsx')
      );
    } catch {
      // Symlink creation might require privileges on certain OS configurations
    }
  });

  afterAll(() => {
    fs.rmSync(testRoot, { recursive: true, force: true });
    fs.rmSync(outsideDir, { recursive: true, force: true });
  });

  it('allows safe relative paths inside project root', () => {
    const resolved = validateSafePath('src/App.tsx', testRoot);
    expect(resolved).toBe(path.join(testRoot, 'src', 'App.tsx'));
  });

  it('allows safe absolute paths inside project root', () => {
    const absPath = path.join(testRoot, 'src', 'App.tsx');
    const resolved = validateSafePath(absPath, testRoot);
    expect(resolved).toBe(absPath);
  });

  it('allows files inside .agent-hover directory', () => {
    const resolved = validateSafePath('.agent-hover/screenshots/shot.png', testRoot);
    expect(resolved).toBe(path.join(testRoot, '.agent-hover', 'screenshots', 'shot.png'));
  });

  it('denies directory traversal using ../ escaping project root', () => {
    expect(() => validateSafePath('../../etc/passwd', testRoot)).toThrow(/escapes project root/);
    expect(() => validateSafePath('src/../../etc/passwd', testRoot)).toThrow(/escapes project root/);
  });

  it('denies absolute paths outside project root', () => {
    expect(() => validateSafePath('/etc/passwd', testRoot)).toThrow(/escapes project root/);
    expect(() => validateSafePath(path.join(outsideDir, 'secret.txt'), testRoot)).toThrow(/escapes project root/);
  });

  it('denies access to node_modules', () => {
    expect(() => validateSafePath('node_modules/some-pkg/index.js', testRoot)).toThrow(/restricted directory/);
    expect(() => validateSafePath(path.join(testRoot, 'node_modules/some-pkg/index.js'), testRoot)).toThrow(/restricted directory/);
  });

  it('denies access to .git', () => {
    expect(() => validateSafePath('.git/config', testRoot)).toThrow(/restricted directory|hidden path/);
  });

  it('denies access to hidden files like .env', () => {
    expect(() => validateSafePath('.env', testRoot)).toThrow(/hidden path/);
  });

  it('denies symlink escaping outside project root', () => {
    const linkPath = path.join(testRoot, 'src', 'escaped-link.txt');
    if (fs.existsSync(linkPath)) {
      expect(() => validateSafePath('src/escaped-link.txt', testRoot)).toThrow(/Symlink escape denied/);
    }
  });

  it('allows valid symlink pointing inside project root', () => {
    const linkPath = path.join(testRoot, 'src', 'valid-link.tsx');
    if (fs.existsSync(linkPath)) {
      const resolved = validateSafePath('src/valid-link.tsx', testRoot);
      expect(resolved).toBe(linkPath);
    }
  });

  it('enforces maxSizeBytes limit on existing files', () => {
    const target = 'src/App.tsx';
    expect(() => validateSafePath(target, testRoot, { maxSizeBytes: 5 })).toThrow(/exceeds limit/);
    const resolved = validateSafePath(target, testRoot, { maxSizeBytes: 10000 });
    expect(resolved).toBe(path.join(testRoot, 'src', 'App.tsx'));
  });

  it('rejects empty or invalid paths', () => {
    expect(() => validateSafePath('', testRoot)).toThrow(/non-empty string/);
    expect(() => validateSafePath(null as any, testRoot)).toThrow(/non-empty string/);
  });
});
