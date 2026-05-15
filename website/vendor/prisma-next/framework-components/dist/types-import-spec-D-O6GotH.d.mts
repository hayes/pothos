//#region src/shared/types-import-spec.d.ts
/**
 * Specifies how to import TypeScript types from a package.
 * Used in extension pack manifests to declare codec and operation type imports.
 */
interface TypesImportSpec {
  readonly package: string;
  readonly named: string;
  readonly alias: string;
}
//#endregion
export { TypesImportSpec as t };
//# sourceMappingURL=types-import-spec-D-O6GotH.d.mts.map