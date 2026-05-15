import { i as AuthoringContributions } from "./framework-authoring-BdrFDx4x.mjs";
import { t as Codec } from "./codec-types-CB0jWeHU.mjs";
import { t as TypesImportSpec } from "./types-import-spec-D-O6GotH.mjs";
import { ColumnDefault, ExecutionMutationDefaultValue } from "@prisma-next/contract/types";

//#region src/shared/mutation-default-types.d.ts
interface SourcePosition {
  readonly offset: number;
  readonly line: number;
  readonly column: number;
}
interface SourceSpan {
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}
interface SourceDiagnostic {
  readonly code: string;
  readonly message: string;
  readonly sourceId?: string;
  readonly span?: SourceSpan;
  readonly data?: Readonly<Record<string, unknown>>;
}
interface DefaultFunctionArgument {
  readonly raw: string;
  readonly span: SourceSpan;
}
interface ParsedDefaultFunctionCall {
  readonly name: string;
  readonly raw: string;
  readonly args: readonly DefaultFunctionArgument[];
  readonly span: SourceSpan;
}
interface DefaultFunctionLoweringContext {
  readonly sourceId: string;
  readonly modelName: string;
  readonly fieldName: string;
  readonly columnCodecId?: string;
}
type LoweredDefaultValue = {
  readonly kind: 'storage';
  readonly defaultValue: ColumnDefault;
} | {
  readonly kind: 'execution';
  readonly generated: ExecutionMutationDefaultValue;
};
type LoweredDefaultResult = {
  readonly ok: true;
  readonly value: LoweredDefaultValue;
} | {
  readonly ok: false;
  readonly diagnostic: SourceDiagnostic;
};
type DefaultFunctionLoweringHandler = (input: {
  readonly call: ParsedDefaultFunctionCall;
  readonly context: DefaultFunctionLoweringContext;
}) => LoweredDefaultResult;
interface DefaultFunctionRegistryEntry {
  readonly lower: DefaultFunctionLoweringHandler;
  readonly usageSignatures?: readonly string[];
}
type DefaultFunctionRegistry = ReadonlyMap<string, DefaultFunctionRegistryEntry>;
interface MutationDefaultGeneratorDescriptor {
  readonly id: string;
  readonly applicableCodecIds: readonly string[];
  readonly resolveGeneratedColumnDescriptor?: (input: {
    readonly generated: ExecutionMutationDefaultValue;
  }) => {
    readonly codecId: string;
    readonly nativeType: string;
    readonly typeRef?: string;
    readonly typeParams?: Record<string, unknown>;
  } | undefined;
}
interface ControlMutationDefaultEntry {
  readonly lower: (input: {
    readonly call: ParsedDefaultFunctionCall;
    readonly context: DefaultFunctionLoweringContext;
  }) => LoweredDefaultResult;
  readonly usageSignatures?: readonly string[];
}
type ControlMutationDefaultRegistry = ReadonlyMap<string, ControlMutationDefaultEntry>;
interface ControlMutationDefaults {
  readonly defaultFunctionRegistry: ControlMutationDefaultRegistry;
  readonly generatorDescriptors: readonly MutationDefaultGeneratorDescriptor[];
}
//#endregion
//#region src/shared/framework-components.d.ts
/**
 * Declarative fields that describe component metadata.
 */
interface ComponentMetadata {
  /** Component version (semver) */
  readonly version: string;
  /**
   * Capabilities this component provides.
   *
   * For adapters, capabilities must be declared on the adapter descriptor (so they are emitted into
   * the contract) and also exposed in runtime adapter code (e.g. `adapter.profile.capabilities`);
   * keep these declarations in sync. Targets are identifiers/descriptors and typically do not
   * declare capabilities.
   */
  readonly capabilities?: Record<string, unknown>;
  /** Type imports for contract.d.ts generation */
  readonly types?: {
    readonly codecTypes?: {
      /**
       * Base codec types import spec.
       * Optional: adapters typically provide this, extensions usually don't.
       */
      readonly import?: TypesImportSpec;
      /**
       * Additional type-only imports for parameterized codec branded types.
       *
       * These imports are included in generated `contract.d.ts` but are NOT treated as
       * codec type maps (i.e., they should not be intersected into `export type CodecTypes = ...`).
       *
       * Example: `Vector<N>` for pgvector codecs that emit `Vector<1536>`
       */
      readonly typeImports?: ReadonlyArray<TypesImportSpec>;
      /**
       * Optional control-plane hooks keyed by codecId.
       * Used by family-specific planners/verifiers to handle storage types.
       */
      readonly controlPlaneHooks?: Record<string, unknown>;
      /**
       * Codec instances contributed by this component.
       * Used to build a CodecLookup for codec-dispatched type rendering during emission.
       */
      readonly codecInstances?: ReadonlyArray<Codec>;
    };
    readonly operationTypes?: {
      readonly import: TypesImportSpec;
    };
    readonly queryOperationTypes?: {
      readonly import: TypesImportSpec;
    };
    readonly storage?: ReadonlyArray<{
      readonly typeId: string;
      readonly familyId: string;
      readonly targetId: string;
      readonly nativeType?: string;
    }>;
  };
  /**
   * Optional pure-data authoring contributions exposed by this component.
   *
   * These contributions are safe to include on pack refs and descriptors because
   * they contain only declarative metadata. Higher-level authoring packages may
   * project them into concrete helper functions for TS-first workflows.
   */
  readonly authoring?: AuthoringContributions;
  /**
   * Scalar type name to codec ID mapping contributed by this component.
   * Assembled by `createControlStack` with duplicate detection.
   */
  readonly scalarTypeDescriptors?: ReadonlyMap<string, string>;
  /**
   * Mutation default function handlers and generator descriptors contributed
   * by this component. Assembled by `createControlStack` with duplicate detection.
   */
  readonly controlMutationDefaults?: ControlMutationDefaults;
}
/**
 * Base descriptor for any framework component.
 *
 * All component descriptors share these fundamental properties that identify
 * the component and provide its metadata. This interface is extended by
 * specific descriptor types (FamilyDescriptor, TargetDescriptor, etc.).
 *
 * @template Kind - Discriminator literal identifying the component type.
 *   Built-in kinds are 'family', 'target', 'adapter', 'driver', 'extension',
 *   but the type accepts any string to allow ecosystem extensions.
 *
 * @example
 * ```ts
 * // All descriptors have these properties
 * descriptor.kind     // The Kind type parameter (e.g., 'family', 'target', or custom kinds)
 * descriptor.id       // Unique string identifier (e.g., 'sql', 'postgres')
 * descriptor.version  // Component version (semver)
 * ```
 */
interface ComponentDescriptor<Kind extends string> extends ComponentMetadata {
  /** Discriminator identifying the component type */
  readonly kind: Kind;
  /** Unique identifier for this component (e.g., 'sql', 'postgres', 'pgvector') */
  readonly id: string;
}
interface ContractComponentRequirementsCheckInput {
  readonly contract: {
    readonly target: string;
    readonly targetFamily?: string | undefined;
    readonly extensionPacks?: Record<string, unknown> | undefined;
  };
  readonly expectedTargetFamily?: string | undefined;
  readonly expectedTargetId?: string | undefined;
  readonly providedComponentIds: Iterable<string>;
}
interface ContractComponentRequirementsCheckResult {
  readonly familyMismatch?: {
    readonly expected: string;
    readonly actual: string;
  } | undefined;
  readonly targetMismatch?: {
    readonly expected: string;
    readonly actual: string;
  } | undefined;
  readonly missingExtensionPackIds: readonly string[];
}
declare function checkContractComponentRequirements(input: ContractComponentRequirementsCheckInput): ContractComponentRequirementsCheckResult;
/**
 * Descriptor for a family component.
 *
 * A "family" represents a category of data sources with shared semantics
 * (e.g., SQL databases, document stores). Families define:
 * - Query semantics and operations (SELECT, INSERT, find, aggregate, etc.)
 * - Contract structure (tables vs collections, columns vs fields)
 * - Type system and codecs
 *
 * Families are the top-level grouping. Each family contains multiple targets
 * (e.g., SQL family contains Postgres, MySQL, SQLite targets).
 *
 * Extended by plane-specific descriptors:
 * - `ControlFamilyDescriptor` - adds `emission` for CLI/tooling operations
 * - `RuntimeFamilyDescriptor` - adds runtime-specific factory methods
 *
 * @template TFamilyId - Literal type for the family identifier (e.g., 'sql', 'document')
 *
 * @example
 * ```ts
 * import sql from '@prisma-next/family-sql/control';
 *
 * sql.kind     // 'family'
 * sql.familyId // 'sql'
 * sql.id       // 'sql'
 * ```
 */
interface FamilyDescriptor<TFamilyId extends string> extends ComponentDescriptor<'family'> {
  /** The family identifier (e.g., 'sql', 'document') */
  readonly familyId: TFamilyId;
}
/**
 * Descriptor for a target component.
 *
 * A "target" represents a specific database or data store within a family
 * (e.g., Postgres, MySQL, MongoDB). Targets define:
 * - Native type mappings (e.g., Postgres int4 → TypeScript number)
 * - Target-specific capabilities (e.g., RETURNING, LATERAL joins)
 *
 * Targets are bound to a family and provide the target-specific implementation
 * details that adapters and drivers use.
 *
 * Extended by plane-specific descriptors:
 * - `ControlTargetDescriptor` - adds optional `migrations` capability
 * - `RuntimeTargetDescriptor` - adds runtime factory method
 *
 * @template TFamilyId - Literal type for the family identifier
 * @template TTargetId - Literal type for the target identifier (e.g., 'postgres', 'mysql')
 *
 * @example
 * ```ts
 * import postgres from '@prisma-next/target-postgres/control';
 *
 * postgres.kind     // 'target'
 * postgres.familyId // 'sql'
 * postgres.targetId // 'postgres'
 * ```
 */
interface TargetDescriptor<TFamilyId extends string, TTargetId extends string> extends ComponentDescriptor<'target'> {
  /** The family this target belongs to */
  readonly familyId: TFamilyId;
  /** The target identifier (e.g., 'postgres', 'mysql', 'mongodb') */
  readonly targetId: TTargetId;
}
/**
 * Base shape for any pack reference.
 * Pack refs are pure JSON-friendly objects safe to import in authoring flows.
 */
interface PackRefBase<Kind extends string, TFamilyId extends string> extends ComponentMetadata {
  readonly kind: Kind;
  readonly id: string;
  readonly familyId: TFamilyId;
  readonly targetId?: string;
  readonly authoring?: AuthoringContributions;
}
type FamilyPackRef<TFamilyId extends string = string> = PackRefBase<'family', TFamilyId>;
type TargetPackRef<TFamilyId extends string = string, TTargetId extends string = string> = PackRefBase<'target', TFamilyId> & {
  readonly targetId: TTargetId;
};
type AdapterPackRef<TFamilyId extends string = string, TTargetId extends string = string> = PackRefBase<'adapter', TFamilyId> & {
  readonly targetId: TTargetId;
};
type ExtensionPackRef<TFamilyId extends string = string, TTargetId extends string = string> = PackRefBase<'extension', TFamilyId> & {
  readonly targetId: TTargetId;
};
type DriverPackRef<TFamilyId extends string = string, TTargetId extends string = string> = PackRefBase<'driver', TFamilyId> & {
  readonly targetId: TTargetId;
};
/**
 * Descriptor for an adapter component.
 *
 * An "adapter" provides the protocol and dialect implementation for a target.
 * Adapters handle:
 * - SQL/query generation (lowering AST to target-specific syntax)
 * - Codec registration (encoding/decoding between JS and wire types)
 * - Type mappings and coercions
 *
 * Adapters are bound to a specific family+target combination and work with
 * any compatible driver for that target.
 *
 * Extended by plane-specific descriptors:
 * - `ControlAdapterDescriptor` - control-plane factory
 * - `RuntimeAdapterDescriptor` - runtime factory
 *
 * @template TFamilyId - Literal type for the family identifier
 * @template TTargetId - Literal type for the target identifier
 *
 * @example
 * ```ts
 * import postgresAdapter from '@prisma-next/adapter-postgres/control';
 *
 * postgresAdapter.kind     // 'adapter'
 * postgresAdapter.familyId // 'sql'
 * postgresAdapter.targetId // 'postgres'
 * ```
 */
interface AdapterDescriptor<TFamilyId extends string, TTargetId extends string> extends ComponentDescriptor<'adapter'> {
  /** The family this adapter belongs to */
  readonly familyId: TFamilyId;
  /** The target this adapter is designed for */
  readonly targetId: TTargetId;
}
/**
 * Descriptor for a driver component.
 *
 * A "driver" provides the connection and execution layer for a target.
 * Drivers handle:
 * - Connection management (pooling, timeouts, retries)
 * - Query execution (sending SQL/commands, receiving results)
 * - Transaction management
 * - Wire protocol communication
 *
 * Drivers are bound to a specific family+target and work with any compatible
 * adapter. Multiple drivers can exist for the same target (e.g., node-postgres
 * vs postgres.js for Postgres).
 *
 * Extended by plane-specific descriptors:
 * - `ControlDriverDescriptor` - creates driver from connection URL
 * - `RuntimeDriverDescriptor` - creates driver with runtime options
 *
 * @template TFamilyId - Literal type for the family identifier
 * @template TTargetId - Literal type for the target identifier
 *
 * @example
 * ```ts
 * import postgresDriver from '@prisma-next/driver-postgres/control';
 *
 * postgresDriver.kind     // 'driver'
 * postgresDriver.familyId // 'sql'
 * postgresDriver.targetId // 'postgres'
 * ```
 */
interface DriverDescriptor<TFamilyId extends string, TTargetId extends string> extends ComponentDescriptor<'driver'> {
  /** The family this driver belongs to */
  readonly familyId: TFamilyId;
  /** The target this driver connects to */
  readonly targetId: TTargetId;
}
/**
 * Descriptor for an extension component.
 *
 * An "extension" adds optional capabilities to a target. Extensions can provide:
 * - Additional operations (e.g., vector similarity search with pgvector)
 * - Custom types and codecs (e.g., vector type)
 * - Extended query capabilities
 *
 * Extensions are bound to a specific family+target and are registered in the
 * config alongside the core components. Multiple extensions can be used together.
 *
 * Extended by plane-specific descriptors:
 * - `ControlExtensionDescriptor` - control-plane extension factory
 * - `RuntimeExtensionDescriptor` - runtime extension factory
 *
 * @template TFamilyId - Literal type for the family identifier
 * @template TTargetId - Literal type for the target identifier
 *
 * @example
 * ```ts
 * import pgvector from '@prisma-next/extension-pgvector/control';
 *
 * pgvector.kind     // 'extension'
 * pgvector.familyId // 'sql'
 * pgvector.targetId // 'postgres'
 * ```
 */
interface ExtensionDescriptor<TFamilyId extends string, TTargetId extends string> extends ComponentDescriptor<'extension'> {
  /** The family this extension belongs to */
  readonly familyId: TFamilyId;
  /** The target this extension is designed for */
  readonly targetId: TTargetId;
}
/** Components bound to a specific family+target combination. */
type TargetBoundComponentDescriptor<TFamilyId extends string, TTargetId extends string> = TargetDescriptor<TFamilyId, TTargetId> | AdapterDescriptor<TFamilyId, TTargetId> | DriverDescriptor<TFamilyId, TTargetId> | ExtensionDescriptor<TFamilyId, TTargetId>;
interface FamilyInstance<TFamilyId extends string> {
  readonly familyId: TFamilyId;
}
interface TargetInstance<TFamilyId extends string, TTargetId extends string> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
}
interface AdapterInstance<TFamilyId extends string, TTargetId extends string> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
}
interface DriverInstance<TFamilyId extends string, TTargetId extends string> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
}
interface ExtensionInstance<TFamilyId extends string, TTargetId extends string> {
  readonly familyId: TFamilyId;
  readonly targetId: TTargetId;
}
//#endregion
export { LoweredDefaultResult as A, ControlMutationDefaultEntry as C, DefaultFunctionLoweringHandler as D, DefaultFunctionLoweringContext as E, SourceSpan as F, MutationDefaultGeneratorDescriptor as M, ParsedDefaultFunctionCall as N, DefaultFunctionRegistry as O, SourceDiagnostic as P, checkContractComponentRequirements as S, ControlMutationDefaults as T, PackRefBase as _, ComponentMetadata as a, TargetInstance as b, DriverDescriptor as c, ExtensionDescriptor as d, ExtensionInstance as f, FamilyPackRef as g, FamilyInstance as h, ComponentDescriptor as i, LoweredDefaultValue as j, DefaultFunctionRegistryEntry as k, DriverInstance as l, FamilyDescriptor as m, AdapterInstance as n, ContractComponentRequirementsCheckInput as o, ExtensionPackRef as p, AdapterPackRef as r, ContractComponentRequirementsCheckResult as s, AdapterDescriptor as t, DriverPackRef as u, TargetBoundComponentDescriptor as v, ControlMutationDefaultRegistry as w, TargetPackRef as x, TargetDescriptor as y };
//# sourceMappingURL=framework-components-AHI6V96G.d.mts.map