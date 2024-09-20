import { Result } from 'oxide.ts/dist';
import { IBackendType, IBackendTypeDescriptor } from './IBackendType';
import { IBackendVariant } from './IBackendVariant';

export interface IBackendManager {
  getSupportedBackends(): IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>[];

  selectBackend(
    backend: IBackendTypeDescriptor<IBackendVariant, IBackendType<IBackendVariant>>
  ): Result<IBackendType<IBackendVariant>, string>;

  getSelectedBackendType(): Result<IBackendType<IBackendVariant>, string>;
}
