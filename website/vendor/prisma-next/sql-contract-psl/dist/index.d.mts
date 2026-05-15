import { AuthoringContributions } from "@prisma-next/framework-components/authoring";
import { Result } from "@prisma-next/utils/result";
import { ParsePslDocumentResult } from "@prisma-next/psl-parser";
import { ControlMutationDefaults, ControlMutationDefaults as ControlMutationDefaults$1, DefaultFunctionLoweringContext, DefaultFunctionLoweringHandler, DefaultFunctionRegistry, DefaultFunctionRegistryEntry, MutationDefaultGeneratorDescriptor } from "@prisma-next/framework-components/control";
import { ContractSourceDiagnostics } from "@prisma-next/config/config-types";
import { Contract } from "@prisma-next/contract/types";
import { ExtensionPackRef, TargetPackRef } from "@prisma-next/framework-components/components";

//#region src/psl-column-resolution.d.ts
type ColumnDescriptor = {
  readonly codecId: string;
  readonly nativeType: string;
  readonly typeRef?: string;
  readonly typeParams?: Record<string, unknown>;
};
//#endregion
//#region src/interpreter.d.ts
interface InterpretPslDocumentToSqlContractInput {
  readonly document: ParsePslDocumentResult;
  readonly target: TargetPackRef<'sql', 'postgres'>;
  readonly scalarTypeDescriptors: ReadonlyMap<string, ColumnDescriptor>;
  readonly composedExtensionPacks?: readonly string[];
  readonly composedExtensionPackRefs?: readonly ExtensionPackRef<'sql', 'postgres'>[];
  readonly controlMutationDefaults?: ControlMutationDefaults$1;
  readonly authoringContributions?: AuthoringContributions;
}
declare function interpretPslDocumentToSqlContract(input: InterpretPslDocumentToSqlContractInput): Result<Contract, ContractSourceDiagnostics>;
//#endregion
export { type ControlMutationDefaults, type DefaultFunctionLoweringContext, type DefaultFunctionLoweringHandler, type DefaultFunctionRegistry, type DefaultFunctionRegistryEntry, type InterpretPslDocumentToSqlContractInput, type MutationDefaultGeneratorDescriptor, interpretPslDocumentToSqlContract };
//# sourceMappingURL=index.d.mts.map