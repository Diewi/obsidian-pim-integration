import { Result } from 'oxide.ts';
import { IContactImporterBackend } from '../contacts/IContactImporterBackend';

export interface IContactBackend {
  createContactImporter(): Result<IContactImporterBackend, string>;
}
