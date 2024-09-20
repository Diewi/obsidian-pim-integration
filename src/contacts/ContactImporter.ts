import { Result } from 'oxide.ts';
import { IContactBackend } from '../pimbackend/IContactBackend';

export interface PimIntegrationContactImporter {
  transformContacts(backend: IContactBackend): Promise<void | Result<string, string>>;
}
