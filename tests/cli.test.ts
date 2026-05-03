import { describe, expect, it, vi } from 'vitest';
import { buildCLI } from '../src/cli';

describe('buildCLI', () => {
  it('starts the TUI when gitvideo is run without arguments', async () => {
    const runTui = vi.fn<[], Promise<void>>().mockResolvedValue(undefined);
    const program = buildCLI({ runTui });

    await program.parseAsync(['node', 'gitvideo']);

    expect(runTui).toHaveBeenCalledOnce();
  });

  it('keeps command mode available for automation', async () => {
    const runTui = vi.fn<[], Promise<void>>().mockResolvedValue(undefined);
    const program = buildCLI({ runTui });

    program.exitOverride();
    program.configureOutput({ writeOut: () => undefined, writeErr: () => undefined });

    await expect(program.parseAsync(['node', 'gitvideo', '--help'])).rejects.toThrow();
    expect(runTui).not.toHaveBeenCalled();
  });
});
