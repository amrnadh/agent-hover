import path from 'path';
import { realpathSync, existsSync, statSync } from 'fs';

export interface PathValidationOptions {
  allowNonExistent?: boolean;
  maxSizeBytes?: number;
}

/**
 * Validates that a requested file path resolves safely within projectRoot.
 * Denies:
 * - Directory traversal (../)
 * - Absolute paths outside projectRoot
 * - Restricted directories (node_modules, .git)
 * - Dotfiles/hidden directories (except .agent-hover data directory)
 * - Symlink escapes outside projectRoot
 * - Files exceeding max size limits
 */
export function validateSafePath(
  filePath: string,
  projectRoot: string,
  options: PathValidationOptions = {}
): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('File path must be a non-empty string');
  }

  // Normalize project root
  const normalizedRoot = path.resolve(projectRoot);

  // Resolve absolute path against project root
  const resolved = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(normalizedRoot, filePath);

  // Verify prefix containment
  if (resolved !== normalizedRoot && !resolved.startsWith(normalizedRoot + path.sep)) {
    throw new Error(`Path traversal denied: '${filePath}' escapes project root`);
  }

  // Deny restricted paths and hidden files/directories (except .agent-hover)
  const relativePath = path.relative(normalizedRoot, resolved);
  const segments = relativePath.split(path.sep).filter(Boolean);
  
  for (const segment of segments) {
    if (segment === 'node_modules' || segment === '.git') {
      throw new Error(`Access denied to restricted directory: '${relativePath}'`);
    }
    if (segment.startsWith('.') && segment !== '.agent-hover') {
      throw new Error(`Access denied to hidden path: '${relativePath}'`);
    }
  }

  // Check symlink escapes and file size
  let realRoot = normalizedRoot;
  try {
    realRoot = realpathSync(normalizedRoot);
  } catch {}

  if (existsSync(resolved)) {
    try {
      const real = realpathSync(resolved);

      if (real !== realRoot && !real.startsWith(realRoot + path.sep)) {
        throw new Error(`Symlink escape denied: '${filePath}' targets outside project root`);
      }

      // Check if realpath resolves inside restricted dirs
      const realRelative = path.relative(realRoot, real);
      const realSegments = realRelative.split(path.sep).filter(Boolean);
      for (const segment of realSegments) {
        if (segment === 'node_modules' || segment === '.git') {
          throw new Error(`Access denied to restricted directory target: '${realRelative}'`);
        }
        if (segment.startsWith('.') && segment !== '.agent-hover') {
          throw new Error(`Access denied to hidden path target: '${realRelative}'`);
        }
      }

      if (options.maxSizeBytes) {
        const stats = statSync(real);
        if (stats.size > options.maxSizeBytes) {
          throw new Error(`File size ${stats.size} exceeds limit of ${options.maxSizeBytes} bytes`);
        }
      }
    } catch (err: any) {
      if (err.message?.includes('denied') || err.message?.includes('exceeds')) {
        throw err;
      }
    }
  } else if (!options.allowNonExistent) {
    // If path does not exist, verify parent directory containment
    let currentDir = path.dirname(resolved);
    while (currentDir && currentDir !== path.dirname(currentDir)) {
      if (existsSync(currentDir)) {
        try {
          const realParent = realpathSync(currentDir);
          if (realParent !== realRoot && !realParent.startsWith(realRoot + path.sep)) {
            throw new Error(`Symlink escape denied on ancestor directory of '${filePath}'`);
          }
        } catch (err: any) {
          if (err.message?.includes('denied')) throw err;
        }
        break;
      }
      currentDir = path.dirname(currentDir);
    }
  }

  return resolved;
}
