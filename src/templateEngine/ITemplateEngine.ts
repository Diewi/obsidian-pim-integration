import { Result } from 'oxide.ts';

export interface ITemplateEngine {
  substitute(template: string, data: any): Result<string, string>;
}
