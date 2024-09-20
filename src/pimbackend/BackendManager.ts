import { Err, Ok, Result } from 'oxide.ts';
import { IBackendManager } from './IBackendManager';
import { IBackendType, IBackendTypeDescriptor } from './IBackendType';
import { BackendTypeOutlook, BackendTypeOutlookDescriptor } from './outlook/BackendTypeOutlook';
import { IBackendVariant } from './IBackendVariant';

export class BackendManager implements IBackendManager {
  private readonly pluginDir: string = '';

  private selectedBackendType: IBackendType | null = null;

  private backendTypes: IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>[] = [
    new BackendTypeOutlookDescriptor(),
  ];

  constructor(pluginDir: string) {
    this.pluginDir = pluginDir;
  }

  getSupportedBackends(): IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>[] {
    return this.backendTypes;
  }

  selectBackend(
    backendDescriptor: IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>
  ): Result<IBackendType, string> {
    try {
      this.selectedBackendType = backendDescriptor.createInstance(this.pluginDir);
      // NOTE: onSelectBackendType() is intentionally NOT called here.
      // It should be called explicitly after variant selection by the caller
      // (e.g., in applySettings or settings UI) to avoid redundant deps.json regeneration.
      return Ok(this.selectedBackendType);
    } catch (error) {
      return Err(`Failed to select backend type: ${error}`);
    }
  }

  getSelectedBackendType(): Result<IBackendType, string> {
    if (this.selectedBackendType) {
      return Ok(this.selectedBackendType);
    } else {
      return Err('No backend selected.');
    }
  }

  // Lightweight headless check used by worker-thread compatibility tests.
  async ping(): Promise<string> {
    return 'pong';
  }
}
