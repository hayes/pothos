import { cuid2 as cuid2$1 } from "uniku/cuid2";
import { ksuid as ksuid$1 } from "uniku/ksuid";
import { nanoid as nanoid$1 } from "uniku/nanoid";
import { ulid as ulid$1 } from "uniku/ulid";
import { uuidv4 as uuidv4$1 } from "uniku/uuid/v4";
import { uuidv7 as uuidv7$1 } from "uniku/uuid/v7";
import { ExecutionMutationDefaultValue } from "@prisma-next/contract/types";
import { ColumnTypeDescriptor } from "@prisma-next/contract-authoring";

//#region src/generator-ids.d.ts
declare const builtinGeneratorIds: readonly ["ulid", "nanoid", "uuidv7", "uuidv4", "cuid2", "ksuid"];
type BuiltinGeneratorId = (typeof builtinGeneratorIds)[number];
//#endregion
//#region src/generators.d.ts
type FirstArg<TFunction> = TFunction extends ((...args: infer TArgs) => unknown) ? TArgs extends [] ? undefined : TArgs[0] : never;
type IdGeneratorOptionsById = {
  readonly ulid: FirstArg<typeof ulid$1>;
  readonly nanoid: FirstArg<typeof nanoid$1>;
  readonly uuidv7: FirstArg<typeof uuidv7$1>;
  readonly uuidv4: FirstArg<typeof uuidv4$1>;
  readonly cuid2: FirstArg<typeof cuid2$1>;
  readonly ksuid: FirstArg<typeof ksuid$1>;
};
//#endregion
//#region src/index.d.ts
type GeneratedColumnDescriptor = {
  readonly type: ColumnTypeDescriptor;
  readonly typeParams?: Record<string, unknown>;
};
declare const builtinGeneratorRegistryMetadata: ReadonlyArray<{
  readonly id: BuiltinGeneratorId;
  readonly applicableCodecIds: readonly string[];
}>;
declare function resolveBuiltinGeneratedColumnDescriptor(input: {
  readonly id: BuiltinGeneratorId;
  readonly params?: Record<string, unknown>;
}): GeneratedColumnDescriptor;
type GeneratedColumnSpec<TCodecId extends string = string> = {
  readonly type: ColumnTypeDescriptor<TCodecId>;
  readonly nullable?: false;
  readonly typeParams?: Record<string, unknown>;
  readonly generated: ExecutionMutationDefaultValue;
};
declare const ulid: (options?: IdGeneratorOptionsById["ulid"]) => GeneratedColumnSpec<"sql/char@1">;
declare const nanoid: (options?: IdGeneratorOptionsById["nanoid"]) => GeneratedColumnSpec<"sql/char@1">;
declare const uuidv7: (options?: IdGeneratorOptionsById["uuidv7"]) => GeneratedColumnSpec<"sql/char@1">;
declare const uuidv4: (options?: IdGeneratorOptionsById["uuidv4"]) => GeneratedColumnSpec<"sql/char@1">;
declare const cuid2: (options?: IdGeneratorOptionsById["cuid2"]) => GeneratedColumnSpec<"sql/char@1">;
declare const ksuid: (options?: IdGeneratorOptionsById["ksuid"]) => GeneratedColumnSpec<"sql/char@1">;
//#endregion
export { GeneratedColumnDescriptor, GeneratedColumnSpec, builtinGeneratorIds, builtinGeneratorRegistryMetadata, cuid2, ksuid, nanoid, resolveBuiltinGeneratedColumnDescriptor, ulid, uuidv4, uuidv7 };
//# sourceMappingURL=index.d.mts.map