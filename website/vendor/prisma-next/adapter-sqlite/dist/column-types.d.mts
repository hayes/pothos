//#region src/core/column-types.d.ts
declare const textColumn: {
  readonly codecId: "sqlite/text@1";
  readonly nativeType: "text";
};
declare const integerColumn: {
  readonly codecId: "sqlite/integer@1";
  readonly nativeType: "integer";
};
declare const realColumn: {
  readonly codecId: "sqlite/real@1";
  readonly nativeType: "real";
};
declare const blobColumn: {
  readonly codecId: "sqlite/blob@1";
  readonly nativeType: "blob";
};
declare const datetimeColumn: {
  readonly codecId: "sqlite/datetime@1";
  readonly nativeType: "text";
};
declare const jsonColumn: {
  readonly codecId: "sqlite/json@1";
  readonly nativeType: "text";
};
declare const bigintColumn: {
  readonly codecId: "sqlite/bigint@1";
  readonly nativeType: "integer";
};
//#endregion
export { bigintColumn, blobColumn, datetimeColumn, integerColumn, jsonColumn, realColumn, textColumn };
//# sourceMappingURL=column-types.d.mts.map