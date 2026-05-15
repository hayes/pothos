import { Contract } from "@prisma-next/contract/types";
import { ContractConfig, ContractConfig as ContractConfig$1 } from "@prisma-next/config/config-types";

//#region src/config-types.d.ts
declare function typescriptContract(contract: Contract, output?: string): ContractConfig$1;
declare function typescriptContractFromPath(contractPath: string, output?: string): ContractConfig$1;
//#endregion
export { type ContractConfig, typescriptContract, typescriptContractFromPath };
//# sourceMappingURL=config-types.d.mts.map