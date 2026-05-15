//#region src/validate-domain.d.ts
interface DomainModelShape {
  readonly fields: Record<string, unknown>;
  readonly relations?: Record<string, {
    readonly to: string;
  }>;
  readonly discriminator?: {
    readonly field: string;
  };
  readonly variants?: Record<string, unknown>;
  readonly base?: string;
  readonly owner?: string;
}
interface DomainContractShape {
  readonly roots: Record<string, string>;
  readonly models: Record<string, DomainModelShape>;
  readonly valueObjects?: Record<string, {
    readonly fields: Record<string, unknown>;
  }>;
}
declare function validateContractDomain(contract: DomainContractShape): void;
//#endregion
export { type DomainContractShape, type DomainModelShape, validateContractDomain };
//# sourceMappingURL=validate-domain.d.mts.map