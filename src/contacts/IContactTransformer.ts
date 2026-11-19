import { Result } from 'oxide.ts';
import { vCardTs2_1, vCardTs3_0, vCardTs4_0 } from 'typed-vcard';

export interface IContactTransformer {
  transformSingleContact(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  getContactRefName(vCard: vCardTs2_1 | vCardTs3_0 | vCardTs4_0): Result<string, string>;

  writeToFile(mdContent: string, filePath: string): Promise<void>;

  fileExists(filePath: string): Promise<boolean>;
}
