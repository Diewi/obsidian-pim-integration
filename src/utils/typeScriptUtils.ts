export class TypeScriptUtils {
  static checkTypeInList<S, T extends S>(item: T, list: S[]): boolean {
    for (const listItem of list) {
      if (typeof item === typeof listItem) {
        return true;
      }
    }
    return false;
  }
}
