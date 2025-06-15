import "./global-types";
import "./schema-builder";
import SchemaBuilder, {
  BasePlugin,
  type PothosEnumValueConfig,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
  type TypeParam,
} from "@pothos/core";
import { defaultFieldResolver } from "graphql";
import { providesMap } from "./external-ref";
import {
  addUsedDirectives,
  entityMapping,
  keyDirective,
  mergeDirectives,
} from "./util";
export { hasResolvableKey } from "./schema-builder";

export * from "./types";

const pluginName = "federation";

export default pluginName;

export class PothosFederationPlugin<
  Types extends SchemaTypes
> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig) {
    const entityConfig = entityMapping.get(this.builder)?.get(typeConfig.name);

    const apollo = entityConfig
      ? {
          ...(typeConfig.extensions?.apollo as {}),
          subgraph: {
            ...(typeConfig.extensions?.apollo as { subgraph: {} })?.subgraph,
            resolveReference: entityConfig.resolveReference,
          },
        }
      : typeConfig.extensions?.apollo;

    const typeDirectives = [
      ...(entityConfig ? keyDirective(entityConfig.key) : []),
      ...(entityConfig?.interfaceObject
        ? [{ name: "interfaceObject", args: {} }]
        : []),
      ...getCommonDirectives(typeConfig),
    ];

    addUsedDirectives(
      this.builder,
      typeDirectives.map((d) => d.name)
    );

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        apollo,
        directives: mergeDirectives(
          typeConfig.extensions?.directives as [],
          typeDirectives
        ),
      },
    };
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>
  ): PothosOutputFieldConfig<Types> | null {
    const options =
      fieldConfig.pothosOptions as PothosSchemaTypes.FieldOptionsByKind<
        Types,
        unknown,
        TypeParam<Types>,
        false,
        {},
        {},
        {}
      >["ExtendedEntity"];

    const ref = Array.isArray(options.type) ? options.type[0] : options.type;
    const resolve = (
      fieldConfig.kind === "ExternalEntity"
        ? (defaultFieldResolver as never)
        : fieldConfig.resolve
    )!;

    const fieldDirectives = [
      options.requires
        ? { name: "requires", args: { fields: options.requires.selection } }
        : null,
      fieldConfig.kind === "ExternalEntity" ? { name: "external" } : null,
      providesMap.has(ref)
        ? { name: "provides", args: { fields: providesMap.get(ref) } }
        : null,
      fieldConfig.pothosOptions.override
        ? { name: "override", args: fieldConfig.pothosOptions.override }
        : null,
      ...getCommonDirectives(fieldConfig),
    ].filter(Boolean) as { name: string }[];

    addUsedDirectives(
      this.builder,
      fieldDirectives.map((d) => d.name)
    );

    const directives = mergeDirectives(
      fieldConfig.extensions?.directives as [],
      fieldDirectives
    );

    return {
      ...fieldConfig,
      resolve,
      extensions: {
        ...fieldConfig.extensions,
        directives,
      },
    };
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    return addCommonDirectives(this.builder, fieldConfig);
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    return addCommonDirectives(this.builder, valueConfig);
  }
}

function getCommonDirectives<
  T extends {
    extensions?: Record<string, unknown> | null;
    pothosOptions: {
      tag?: string[] | string;
      inaccessible?: boolean;
      shareable?: boolean;
      authenticated?: boolean;
      requiresScopes?: unknown[][];
      policy?: unknown[][];
      cost?: number;
      listSize?: {
        assumedSize?: number;
        slicingArguments?: string[];
        sizedFields?: string[];
        requireOneSlicingArgument?: boolean;
      };
    };
  }
>(config: T) {
  const tags =
    typeof config.pothosOptions.tag === "string"
      ? [config.pothosOptions.tag]
      : config.pothosOptions.tag ?? [];
  const tagDirectives = tags.map((tag) => ({
    name: "tag",
    args: { name: tag },
  }));
  const requiresScopes = config.pothosOptions.requiresScopes
    ? {
        name: "requiresScopes",
        args: { scopes: config.pothosOptions.requiresScopes },
      }
    : null;
  const policy = config.pothosOptions.policy
    ? { name: "policy", args: { policies: config.pothosOptions.policy } }
    : null;
  const cost =
    config.pothosOptions.cost !== undefined
      ? { name: "cost", args: { weight: config.pothosOptions.cost } }
      : null;
  const listSize = config.pothosOptions.listSize
    ? {
        name: "listSize",
        args: Object.fromEntries(
          Object.entries(config.pothosOptions.listSize).filter(
            ([, v]) => v !== undefined
          )
        ),
      }
    : null;

  return [
    config.pothosOptions.inaccessible ? { name: "inaccessible" } : null,
    config.pothosOptions.shareable ? { name: "shareable" } : null,
    config.pothosOptions.authenticated ? { name: "authenticated" } : null,
    requiresScopes,
    policy,
    cost,
    listSize,
    ...tagDirectives,
  ].filter(Boolean) as { name: string }[];
}

function addCommonDirectives<
  Types extends SchemaTypes,
  T extends {
    extensions?: Record<string, unknown> | null;
    pothosOptions: {
      tag?: string[] | string;
      inaccessible?: boolean;
    };
  }
>(builder: PothosSchemaTypes.SchemaBuilder<Types>, config: T): T {
  const commonDirectives = getCommonDirectives(config);
  addUsedDirectives(
    builder,
    commonDirectives.map((d) => d.name)
  );

  const directives = mergeDirectives(
    config.extensions?.directives as [],
    commonDirectives
  );

  return {
    ...config,
    extensions: {
      ...config.extensions,
      directives,
    },
  };
}

SchemaBuilder.registerPlugin(pluginName, PothosFederationPlugin);
