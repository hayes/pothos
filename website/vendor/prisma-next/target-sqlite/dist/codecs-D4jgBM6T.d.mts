import * as _prisma_next_sql_relational_core_ast0 from "@prisma-next/sql-relational-core/ast";

//#region src/core/codecs.d.ts
type JsonValue = string | number | boolean | null | {
  readonly [key: string]: JsonValue;
} | readonly JsonValue[];
declare const codecs: _prisma_next_sql_relational_core_ast0.CodecDefBuilder<{
  char: _prisma_next_sql_relational_core_ast0.Codec<"sql/char@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
  varchar: _prisma_next_sql_relational_core_ast0.Codec<"sql/varchar@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
  int: _prisma_next_sql_relational_core_ast0.Codec<"sql/int@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  float: _prisma_next_sql_relational_core_ast0.Codec<"sql/float@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  text: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/text@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
  integer: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/integer@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  real: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/real@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
  blob: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/blob@1", readonly ["equality"], Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, Record<string, unknown>, unknown>;
  datetime: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/datetime@1", readonly ["equality", "order"], string, Date, Record<string, unknown>, unknown>;
  json: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/json@1", readonly ["equality"], string | number | boolean | {
    readonly [key: string]: JsonValue;
  } | readonly JsonValue[] | null, string | number | boolean | {
    readonly [key: string]: JsonValue;
  } | readonly JsonValue[] | null, Record<string, unknown>, unknown>;
} & Record<"bigint", _prisma_next_sql_relational_core_ast0.Codec<"sqlite/bigint@1", readonly ["equality", "order", "numeric"], number | bigint, bigint, Record<string, unknown>, unknown>>>;
declare const codecDefinitions: {
  readonly char: {
    readonly typeId: "sql/char@1";
    readonly scalar: "char";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sql/char@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly varchar: {
    readonly typeId: "sql/varchar@1";
    readonly scalar: "varchar";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sql/varchar@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly int: {
    readonly typeId: "sql/int@1";
    readonly scalar: "int";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sql/int@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly float: {
    readonly typeId: "sql/float@1";
    readonly scalar: "float";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sql/float@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly text: {
    readonly typeId: "sqlite/text@1";
    readonly scalar: "text";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/text@1", readonly ["equality", "order", "textual"], string, string, Record<string, unknown>, unknown>;
    readonly input: string;
    readonly output: string;
    readonly jsType: string;
  };
  readonly integer: {
    readonly typeId: "sqlite/integer@1";
    readonly scalar: "integer";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/integer@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly real: {
    readonly typeId: "sqlite/real@1";
    readonly scalar: "real";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/real@1", readonly ["equality", "order", "numeric"], number, number, Record<string, unknown>, unknown>;
    readonly input: number;
    readonly output: number;
    readonly jsType: number;
  };
  readonly blob: {
    readonly typeId: "sqlite/blob@1";
    readonly scalar: "blob";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/blob@1", readonly ["equality"], Uint8Array<ArrayBufferLike>, Uint8Array<ArrayBufferLike>, Record<string, unknown>, unknown>;
    readonly input: Uint8Array<ArrayBufferLike>;
    readonly output: Uint8Array<ArrayBufferLike>;
    readonly jsType: Uint8Array<ArrayBufferLike>;
  };
  readonly datetime: {
    readonly typeId: "sqlite/datetime@1";
    readonly scalar: "datetime";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/datetime@1", readonly ["equality", "order"], string, Date, Record<string, unknown>, unknown>;
    readonly input: Date;
    readonly output: Date;
    readonly jsType: Date;
  };
  readonly json: {
    readonly typeId: "sqlite/json@1";
    readonly scalar: "json";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/json@1", readonly ["equality"], string | number | boolean | {
      readonly [key: string]: JsonValue;
    } | readonly JsonValue[] | null, string | number | boolean | {
      readonly [key: string]: JsonValue;
    } | readonly JsonValue[] | null, Record<string, unknown>, unknown>;
    readonly input: string | number | boolean | {
      readonly [key: string]: JsonValue;
    } | readonly JsonValue[] | null;
    readonly output: string | number | boolean | {
      readonly [key: string]: JsonValue;
    } | readonly JsonValue[] | null;
    readonly jsType: string | number | boolean | {
      readonly [key: string]: JsonValue;
    } | readonly JsonValue[] | null;
  };
  readonly bigint: {
    readonly typeId: "sqlite/bigint@1";
    readonly scalar: "bigint";
    readonly codec: _prisma_next_sql_relational_core_ast0.Codec<"sqlite/bigint@1", readonly ["equality", "order", "numeric"], number | bigint, bigint, Record<string, unknown>, unknown>;
    readonly input: bigint;
    readonly output: bigint;
    readonly jsType: bigint;
  };
};
declare const dataTypes: {
  readonly char: "sql/char@1";
  readonly varchar: "sql/varchar@1";
  readonly int: "sql/int@1";
  readonly float: "sql/float@1";
  readonly text: "sqlite/text@1";
  readonly integer: "sqlite/integer@1";
  readonly real: "sqlite/real@1";
  readonly blob: "sqlite/blob@1";
  readonly datetime: "sqlite/datetime@1";
  readonly json: "sqlite/json@1";
  readonly bigint: "sqlite/bigint@1";
};
type CodecTypes = typeof codecs.CodecTypes;
//#endregion
export { dataTypes as i, JsonValue as n, codecDefinitions as r, CodecTypes as t };
//# sourceMappingURL=codecs-D4jgBM6T.d.mts.map