import { Result } from 'oxide.ts';
import { IContactImporterBackend } from '../contacts/IContactImporterBackend';

export interface IContactBackend {
  createImporter(): Result<IContactImporterBackend, string>;
}
