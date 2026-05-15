import { b as TargetInstance, c as DriverDescriptor, d as ExtensionDescriptor, f as ExtensionInstance, h as FamilyInstance, l as DriverInstance, m as FamilyDescriptor, n as AdapterInstance, t as AdapterDescriptor, y as TargetDescriptor } from "./framework-components-AHI6V96G.mjs";

//#region src/execution/execution-instances.d.ts
interface RuntimeFamilyInstance<TFamilyId extends string> extends FamilyInstance<TFamilyId> {}
interface RuntimeTargetInstance<TFamilyId extends string, TTargetId extends string> extends TargetInstance<TFamilyId, TTargetId> {}
interface RuntimeAdapterInstance<TFamilyId extends string, TTargetId extends string> extends AdapterInstance<TFamilyId, TTargetId> {}
interface RuntimeDriverInstance<TFamilyId extends string, TTargetId extends string> extends DriverInstance<TFamilyId, TTargetId> {}
interface RuntimeExtensionInstance<TFamilyId extends string, TTargetId extends string> extends ExtensionInstance<TFamilyId, TTargetId> {}
//#endregion
//#region src/execution/execution-stack.d.ts
interface ExecutionStack<TFamilyId extends string, TTargetId extends string, TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId> = RuntimeAdapterInstance<TFamilyId, TTargetId>, TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<TFamilyId, TTargetId>, TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId> = RuntimeExtensionInstance<TFamilyId, TTargetId>> {
  readonly target: RuntimeTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter: RuntimeAdapterDescriptor<TFamilyId, TTargetId, TAdapterInstance>;
  readonly driver: RuntimeDriverDescriptor<TFamilyId, TTargetId, unknown, TDriverInstance> | undefined;
  readonly extensionPacks: readonly RuntimeExtensionDescriptor<TFamilyId, TTargetId, TExtensionInstance>[];
}
interface ExecutionStackInstance<TFamilyId extends string, TTargetId extends string, TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId> = RuntimeAdapterInstance<TFamilyId, TTargetId>, TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<TFamilyId, TTargetId>, TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId> = RuntimeExtensionInstance<TFamilyId, TTargetId>> {
  readonly stack: ExecutionStack<TFamilyId, TTargetId, TAdapterInstance, TDriverInstance, TExtensionInstance>;
  readonly target: RuntimeTargetInstance<TFamilyId, TTargetId>;
  readonly adapter: TAdapterInstance;
  readonly driver: TDriverInstance | undefined;
  readonly extensionPacks: readonly TExtensionInstance[];
}
declare function createExecutionStack<TFamilyId extends string, TTargetId extends string, TTargetInstance extends RuntimeTargetInstance<TFamilyId, TTargetId>, TTargetDescriptor extends RuntimeTargetDescriptor<TFamilyId, TTargetId, TTargetInstance>, TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId>, TAdapterDescriptor extends RuntimeAdapterDescriptor<TFamilyId, TTargetId, TAdapterInstance>, TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<TFamilyId, TTargetId>, TDriverDescriptor extends RuntimeDriverDescriptor<TFamilyId, TTargetId, unknown, TDriverInstance> | undefined = undefined, TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId> = RuntimeExtensionInstance<TFamilyId, TTargetId>, TExtensionDescriptor extends RuntimeExtensionDescriptor<TFamilyId, TTargetId, TExtensionInstance> = never>(input: {
  readonly target: TTargetDescriptor;
  readonly adapter: TAdapterDescriptor;
  readonly driver?: TDriverDescriptor | undefined;
  readonly extensionPacks?: readonly TExtensionDescriptor[] | undefined;
}): ExecutionStack<TFamilyId, TTargetId, TAdapterInstance, TDriverInstance, TExtensionInstance> & {
  readonly target: TTargetDescriptor;
  readonly adapter: TAdapterDescriptor;
  readonly driver: TDriverDescriptor | undefined;
  readonly extensionPacks: readonly TExtensionDescriptor[];
};
declare function instantiateExecutionStack<TFamilyId extends string, TTargetId extends string, TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId>, TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId>, TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId>>(stack: ExecutionStack<TFamilyId, TTargetId, TAdapterInstance, TDriverInstance, TExtensionInstance>): ExecutionStackInstance<TFamilyId, TTargetId, TAdapterInstance, TDriverInstance, TExtensionInstance>;
//#endregion
//#region src/execution/execution-descriptors.d.ts
interface RuntimeFamilyDescriptor<TFamilyId extends string, TFamilyInstance extends RuntimeFamilyInstance<TFamilyId> = RuntimeFamilyInstance<TFamilyId>> extends FamilyDescriptor<TFamilyId> {
  create<TTargetId extends string>(options: {
    readonly target: RuntimeTargetDescriptor<TFamilyId, TTargetId>;
    readonly adapter: RuntimeAdapterDescriptor<TFamilyId, TTargetId>;
    readonly driver: RuntimeDriverDescriptor<TFamilyId, TTargetId>;
    readonly extensionPacks: readonly RuntimeExtensionDescriptor<TFamilyId, TTargetId>[];
  }): TFamilyInstance;
}
interface RuntimeTargetDescriptor<TFamilyId extends string, TTargetId extends string, TTargetInstance extends RuntimeTargetInstance<TFamilyId, TTargetId> = RuntimeTargetInstance<TFamilyId, TTargetId>> extends TargetDescriptor<TFamilyId, TTargetId> {
  create(): TTargetInstance;
}
interface RuntimeAdapterDescriptor<TFamilyId extends string, TTargetId extends string, TAdapterInstance extends RuntimeAdapterInstance<TFamilyId, TTargetId> = RuntimeAdapterInstance<TFamilyId, TTargetId>> extends AdapterDescriptor<TFamilyId, TTargetId> {
  /**
   * Construct a runtime adapter instance for this execution stack.
   *
   * Mirrors `ControlAdapterDescriptor.create(stack)` so that adapter
   * implementations may inspect stack-assembled metadata (e.g. codecs
   * contributed by extension packs) when constructing the instance.
   */
  create(stack: ExecutionStack<TFamilyId, TTargetId>): TAdapterInstance;
}
interface RuntimeDriverDescriptor<TFamilyId extends string, TTargetId extends string, TCreateOptions = void, TDriverInstance extends RuntimeDriverInstance<TFamilyId, TTargetId> = RuntimeDriverInstance<TFamilyId, TTargetId>> extends DriverDescriptor<TFamilyId, TTargetId> {
  create(options?: TCreateOptions): TDriverInstance;
}
interface RuntimeExtensionDescriptor<TFamilyId extends string, TTargetId extends string, TExtensionInstance extends RuntimeExtensionInstance<TFamilyId, TTargetId> = RuntimeExtensionInstance<TFamilyId, TTargetId>> extends ExtensionDescriptor<TFamilyId, TTargetId> {
  create(): TExtensionInstance;
}
//#endregion
//#region src/execution/execution-requirements.d.ts
declare function assertRuntimeContractRequirementsSatisfied<TFamilyId extends string, TTargetId extends string>({
  contract,
  family,
  target,
  adapter,
  extensionPacks
}: {
  readonly contract: {
    readonly target: string;
    readonly extensionPacks?: Record<string, unknown>;
  };
  readonly family: RuntimeFamilyDescriptor<TFamilyId>;
  readonly target: RuntimeTargetDescriptor<TFamilyId, TTargetId>;
  readonly adapter: RuntimeAdapterDescriptor<TFamilyId, TTargetId>;
  readonly extensionPacks: readonly RuntimeExtensionDescriptor<TFamilyId, TTargetId>[];
}): void;
//#endregion
export { type ExecutionStack, type ExecutionStackInstance, type RuntimeAdapterDescriptor, type RuntimeAdapterInstance, type RuntimeDriverDescriptor, type RuntimeDriverInstance, type RuntimeExtensionDescriptor, type RuntimeExtensionInstance, type RuntimeFamilyDescriptor, type RuntimeFamilyInstance, type RuntimeTargetDescriptor, type RuntimeTargetInstance, assertRuntimeContractRequirementsSatisfied, createExecutionStack, instantiateExecutionStack };
//# sourceMappingURL=execution.d.mts.map