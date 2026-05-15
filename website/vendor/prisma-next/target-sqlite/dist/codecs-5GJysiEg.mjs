import { a as SQLITE_JSON_CODEC_ID, i as SQLITE_INTEGER_CODEC_ID, n as SQLITE_BLOB_CODEC_ID, o as SQLITE_REAL_CODEC_ID, r as SQLITE_DATETIME_CODEC_ID, s as SQLITE_TEXT_CODEC_ID, t as SQLITE_BIGINT_CODEC_ID } from "./codec-ids-B1-OiN8Q.mjs";
import { codec, defineCodecs, sqlCodecDefinitions } from "@prisma-next/sql-relational-core/ast";

//#region src/core/codecs.ts
const sqlCharCodec = sqlCodecDefinitions.char.codec;
const sqlVarcharCodec = sqlCodecDefinitions.varchar.codec;
const sqlIntCodec = sqlCodecDefinitions.int.codec;
const sqlFloatCodec = sqlCodecDefinitions.float.codec;
const sqliteTextCodec = codec({
	typeId: SQLITE_TEXT_CODEC_ID,
	targetTypes: ["text"],
	traits: [
		"equality",
		"order",
		"textual"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqliteIntegerCodec = codec({
	typeId: SQLITE_INTEGER_CODEC_ID,
	targetTypes: ["integer"],
	traits: [
		"equality",
		"order",
		"numeric"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqliteRealCodec = codec({
	typeId: SQLITE_REAL_CODEC_ID,
	targetTypes: ["real"],
	traits: [
		"equality",
		"order",
		"numeric"
	],
	encode: (value) => value,
	decode: (wire) => wire
});
const sqliteBlobCodec = codec({
	typeId: SQLITE_BLOB_CODEC_ID,
	targetTypes: ["blob"],
	traits: ["equality"],
	encode: (value) => value,
	decode: (wire) => wire,
	encodeJson: (value) => Buffer.from(value).toString("base64"),
	decodeJson: (json) => {
		if (typeof json !== "string") throw new TypeError("sqlite/blob@1 contract value must be a base64 string");
		return new Uint8Array(Buffer.from(json, "base64"));
	}
});
const sqliteDatetimeCodec = codec({
	typeId: SQLITE_DATETIME_CODEC_ID,
	targetTypes: ["text"],
	traits: ["equality", "order"],
	encode: (value) => value.toISOString(),
	decode: (wire) => new Date(wire),
	encodeJson: (value) => value.toISOString(),
	decodeJson: (json) => {
		if (typeof json !== "string") throw new TypeError("sqlite/datetime@1 contract value must be an ISO-8601 string");
		return new Date(json);
	}
});
const sqliteJsonCodec = codec({
	typeId: SQLITE_JSON_CODEC_ID,
	targetTypes: ["text"],
	traits: ["equality"],
	encode: (value) => JSON.stringify(value),
	decode: (wire) => typeof wire === "string" ? JSON.parse(wire) : wire
});
const sqliteBigintCodec = codec({
	typeId: SQLITE_BIGINT_CODEC_ID,
	targetTypes: ["integer"],
	traits: [
		"equality",
		"order",
		"numeric"
	],
	encode: (value) => value,
	decode: (wire) => BigInt(wire),
	encodeJson: (value) => value.toString(),
	decodeJson: (json) => {
		if (typeof json !== "string" && typeof json !== "number") throw new TypeError("sqlite/bigint@1 contract value must be a string or number");
		return BigInt(json);
	}
});
const codecs = defineCodecs().add("char", sqlCharCodec).add("varchar", sqlVarcharCodec).add("int", sqlIntCodec).add("float", sqlFloatCodec).add("text", sqliteTextCodec).add("integer", sqliteIntegerCodec).add("real", sqliteRealCodec).add("blob", sqliteBlobCodec).add("datetime", sqliteDatetimeCodec).add("json", sqliteJsonCodec).add("bigint", sqliteBigintCodec);
const codecDefinitions = codecs.codecDefinitions;
const dataTypes = codecs.dataTypes;

//#endregion
export { dataTypes as n, codecDefinitions as t };
//# sourceMappingURL=codecs-5GJysiEg.mjs.map