//#region src/descriptors.d.ts
type ColumnTypeDescriptor<TCodecId extends string = string> = {
  readonly codecId: TCodecId;
  readonly nativeType: string;
  readonly typeParams?: Record<string, unknown>;
  readonly typeRef?: string;
};
interface IndexDef {
  readonly columns: readonly string[];
  readonly name?: string;
  readonly using?: string;
  readonly config?: Record<string, unknown>;
}
interface ForeignKeyDefaultsState {
  readonly constraint: boolean;
  readonly index: boolean;
}
//#endregion
export { type ColumnTypeDescriptor, type ForeignKeyDefaultsState, type IndexDef };
//# sourceMappingURL=index.d.mts.map