import { Result } from 'oxide.ts/dist';

export interface IBackendVariantDescriptor<T extends IBackendVariant = IBackendVariant> {
  getName(): string;

  createInstance(): T;
}

export interface IBackendVariant {
  getSettings(): BackendSetting<any>[];

  onSelectVariant(): Result<void, string>;
}

export type BackendSetting<T> = {
  key: string;
  value: T;
};
