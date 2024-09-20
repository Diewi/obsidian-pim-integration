import { Result } from 'oxide.ts/dist';
import { IContactImporterBackend } from '../contacts/IContactImporterBackend';
import { IBackendVariant, IBackendVariantDescriptor } from './IBackendVariant';

export interface IBackendTypeDescriptor<
  S extends IBackendVariant,
  T extends IBackendType<S> = IBackendType<S>,
> {
  getName(): string;

  createInstance(pluginDir: string): T;
}

export interface IBackendType<T extends IBackendVariant = IBackendVariant> {
  getVariants(): IBackendVariantDescriptor<T>[];

  /**
   * Called when a backend type/variant is selected. Performs initialization
   * like generating deps.json files.
   *
   * @param variant The selected backend variant
   * @param skipGeneration If true, skips file generation (used during initial plugin load)
   */
  onSelectBackendType(variant: T, skipGeneration?: boolean): Promise<Result<void, string>>;

  selectBackendVariant(backend: IBackendVariantDescriptor): Result<T, string>;

  getSelectedBackendVariant(): Result<IBackendVariant, string>;
}
