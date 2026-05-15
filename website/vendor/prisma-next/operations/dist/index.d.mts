//#region src/index.d.ts
interface ParamSpec {
  readonly codecId?: string;
  readonly traits?: readonly string[];
  readonly nullable: boolean;
}
interface ReturnSpec {
  readonly codecId: string;
  readonly nullable: boolean;
}
type SelfSpec = {
  readonly codecId: string;
  readonly traits?: never;
} | {
  readonly traits: readonly string[];
  readonly codecId?: never;
};
interface OperationEntry {
  readonly self?: SelfSpec;
  readonly impl: (...args: never[]) => unknown;
}
type OperationDescriptor<T extends OperationEntry = OperationEntry> = T & {
  readonly method: string;
};
interface OperationRegistry<T extends OperationEntry = OperationEntry> {
  register(descriptor: OperationDescriptor<T>): void;
  entries(): Readonly<Record<string, T>>;
}
declare function createOperationRegistry<T extends OperationEntry = OperationEntry>(): OperationRegistry<T>;
//#endregion
export { OperationDescriptor, OperationEntry, OperationRegistry, ParamSpec, ReturnSpec, SelfSpec, createOperationRegistry };
//# sourceMappingURL=index.d.mts.map