export interface ITemplateEngine {
  substitute(template: string, data: any): string;
}
