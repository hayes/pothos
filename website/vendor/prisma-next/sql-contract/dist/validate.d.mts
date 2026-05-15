import { k as SqlStorage } from "./types-D1QODyT3.mjs";
import { Contract } from "@prisma-next/contract/types";
import { CodecLookup } from "@prisma-next/framework-components/codec";

//#region src/validate.d.ts
declare function validateContract<TContract extends Contract<SqlStorage>>(value: unknown, codecLookup: CodecLookup): TContract;
//#endregion
export { validateContract };
//# sourceMappingURL=validate.d.mts.map