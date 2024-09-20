import { App, FileSystemAdapter, Notice, Plugin } from 'obsidian';
import { Err, Ok, Result } from 'oxide.ts';
import path from 'path';

export class ObsidianUtils {
  static getPluginDir(plugin: Plugin, app: App): Result<string, string> {
    let basePath;
    if (app.vault.adapter instanceof FileSystemAdapter) {
      basePath = app.vault.adapter.getBasePath();
    } else {
      return Err('Cannot determine base path.');
    }
    return Ok([basePath, app.vault.configDir, 'plugins', plugin.manifest.id].join(path.sep));
  }

  static logAndNotice(message: string, durationMs?: number): void {
    console.log(message);
    new Notice(message, durationMs);
  }
}
