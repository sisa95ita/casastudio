export type PackageName = `@casastudio/${string}`;

export function createPackageName(name: string): PackageName {
  return `@casastudio/${name}`;
}
