import { Result } from 'oxide.ts';
import { vCardTs2_1 } from 'typed-vcard/src/vCardTs2_1';
import { vCardTs3_0 } from 'typed-vcard/src/vCardTs3_0';
import { vCardTs4_0 } from 'typed-vcard/src/vCardTs4_0';

export interface IContactTransformer {
  transformSingleContact(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  writeToFile(mdContent: string, contactName: string): void;
}
