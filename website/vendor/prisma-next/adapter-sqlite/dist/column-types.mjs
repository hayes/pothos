import { SQLITE_BIGINT_CODEC_ID, SQLITE_BLOB_CODEC_ID, SQLITE_DATETIME_CODEC_ID, SQLITE_INTEGER_CODEC_ID, SQLITE_JSON_CODEC_ID, SQLITE_REAL_CODEC_ID, SQLITE_TEXT_CODEC_ID } from "@prisma-next/target-sqlite/codec-ids";

//#region src/core/column-types.ts
const textColumn = {
	codecId: SQLITE_TEXT_CODEC_ID,
	nativeType: "text"
};
const integerColumn = {
	codecId: SQLITE_INTEGER_CODEC_ID,
	nativeType: "integer"
};
const realColumn = {
	codecId: SQLITE_REAL_CODEC_ID,
	nativeType: "real"
};
const blobColumn = {
	codecId: SQLITE_BLOB_CODEC_ID,
	nativeType: "blob"
};
const datetimeColumn = {
	codecId: SQLITE_DATETIME_CODEC_ID,
	nativeType: "text"
};
const jsonColumn = {
	codecId: SQLITE_JSON_CODEC_ID,
	nativeType: "text"
};
const bigintColumn = {
	codecId: SQLITE_BIGINT_CODEC_ID,
	nativeType: "integer"
};

//#endregion
export { bigintColumn, blobColumn, datetimeColumn, integerColumn, jsonColumn, realColumn, textColumn };
//# sourceMappingURL=column-types.mjs.map