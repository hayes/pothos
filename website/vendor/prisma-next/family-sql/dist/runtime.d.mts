import { RuntimeFamilyDescriptor, RuntimeFamilyInstance } from "@prisma-next/framework-components/execution";

//#region src/core/runtime-instance.d.ts

/**
 * SQL execution-plane family instance interface.
 *
 * Note: this is currently named `SqlRuntimeFamilyInstance` because the execution plane
 * framework types are still using the `Runtime*` naming (`RuntimeFamilyInstance`, etc.).
 *
 * This will be renamed to `SqlExecutionFamilyInstance` as part of `TML-1842`.
 */
interface SqlRuntimeFamilyInstance extends RuntimeFamilyInstance<'sql'> {}
//#endregion
//#region src/core/runtime-descriptor.d.ts
/**
 * SQL execution-plane family descriptor.
 *
 * Note: this is currently named `sqlRuntimeFamilyDescriptor` because the execution plane
 * framework types are still using the `Runtime*` naming (`RuntimeFamilyDescriptor`, etc.).
 *
 * This will be renamed to `sqlExecutionFamilyDescriptor` as part of `TML-1842`.
 */
declare const sqlRuntimeFamilyDescriptor: RuntimeFamilyDescriptor<'sql', SqlRuntimeFamilyInstance>;
//#endregion
export { sqlRuntimeFamilyDescriptor as default };
//# sourceMappingURL=runtime.d.mts.map