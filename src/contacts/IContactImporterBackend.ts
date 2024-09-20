import { Result } from 'oxide.ts';

export interface IContactImporterBackend {
  getContacts(): Promise<Result<string, string>>;
}
