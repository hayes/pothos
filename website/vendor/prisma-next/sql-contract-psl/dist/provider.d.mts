import { ContractConfig } from "@prisma-next/config/config-types";
import { ExtensionPackRef, TargetPackRef } from "@prisma-next/framework-components/components";

//#region src/provider.d.ts
interface PrismaContractOptions {
  readonly output?: string;
  readonly target: TargetPackRef<'sql', 'postgres'>;
  readonly composedExtensionPackRefs?: readonly ExtensionPackRef<'sql', 'postgres'>[];
}
declare function prismaContract(schemaPath: string, options: PrismaContractOptions): ContractConfig;
//#endregion
export { type PrismaContractOptions, prismaContract };
//# sourceMappingURL=provider.d.mts.map