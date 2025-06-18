import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type ImplementableObjectRef,
  type Normalize,
  type PothosOutputFieldConfig,
  type PothosOutputFieldType,
  PothosSchemaError,
  type SchemaTypes,
  sortClasses,
  type TypeParam,
  typeBrandKey,
  unwrapOutputFieldType,
} from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLIsTypeOfFn } from 'graphql';
import type { ErrorFieldOptions, GetTypeName } from './types';

export * from './types';

const pluginName = 'errors';

export default pluginName;

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

export const defaultGetResultName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}Success`;
export const defaultGetListItemResultName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}ItemSuccess`;
export const defaultGetUnionName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}Result`;
export const defaultGetListItemUnionName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${capitalize(fieldName)}ItemResult`;

export const unwrapError = Symbol.for('Pothos.unwrapErrors');

function createErrorProxy(target: {}, ref: unknown, state: { wrapped: boolean }): {} {
  return new Proxy(target, {
    get(err, val, receiver) {
      if (val === unwrapError) {
        return () => {
          state.wrapped = false;
        };
      }

      if (val === typeBrandKey) {
        return ref;
      }

      return Reflect.get(err, val, receiver) as unknown;
    },
    getPrototypeOf(err) {
      const proto = Reflect.getPrototypeOf(err) as {};

      if (!state.wrapped || !proto) {
        return proto;
      }

      return createErrorProxy(proto, ref, state);
    },
  });
}

const errorTypeMap = new WeakMap<{}, new (...args: never[]) => Error>();

export class PothosErrorsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    if (isTypeOf) {
      return (parent, context, info) => {
        if (typeof parent === 'object' && parent) {
          (parent as { [unwrapError]?: () => void })[unwrapError]?.();
        }

        return isTypeOf(parent, context, info);
      };
    }

    return isTypeOf;
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const errorOptions = fieldConfig.pothosOptions.errors;
    const itemErrorOptions = fieldConfig.pothosOptions.itemErrors;
    const errorBuilderOptions = this.builder.options.errors;

    if (!errorOptions && !itemErrorOptions) {
      return fieldConfig;
    }

    const parentTypeName = this.buildCache.getTypeConfig(fieldConfig.parentType).name;

    const itemErrorTypes =
      itemErrorOptions &&
      sortClasses([
        ...new Set([
          ...(itemErrorOptions?.types ?? []),
          ...(errorBuilderOptions?.defaultTypes ?? []),
        ]),
      ]);
    const errorTypes =
      errorOptions &&
      sortClasses([
        ...new Set([...(errorOptions?.types ?? []), ...(errorBuilderOptions?.defaultTypes ?? [])]),
      ]);

    let resultType = fieldConfig.pothosOptions.type;

    if (itemErrorOptions) {
      if (!Array.isArray(fieldConfig.pothosOptions.type) || fieldConfig.type.kind !== 'List') {
        throw new PothosSchemaError(
          `Field ${parentTypeName}.${fieldConfig.name} must return a list when 'itemErrors' is set`,
        );
      }

      const itemFieldType = fieldConfig.type.type;
      const itemType = fieldConfig.pothosOptions.type[0];

      resultType = [
        this.createResultType(
          parentTypeName,
          fieldConfig.name,
          itemType,
          itemFieldType,
          itemErrorOptions,
          `Field ${parentTypeName}.${fieldConfig.name} list items must be an ObjectType when 'directResult' is set to true`,
          defaultGetListItemResultName,
          defaultGetListItemUnionName,
          errorBuilderOptions?.defaultItemResultOptions,
          errorBuilderOptions?.defaultItemUnionOptions,
        ),
      ];

      if (!errorOptions) {
        return {
          ...fieldConfig,
          extensions: {
            ...fieldConfig.extensions,
            pothosItemErrors: itemErrorTypes,
          },
          type: {
            ...fieldConfig.type,
            type: {
              kind: 'Union',
              ref: resultType[0],
              nullable: fieldConfig.type.type.nullable,
            },
          },
        };
      }
    }

    const unionType = this.createResultType(
      parentTypeName,
      fieldConfig.name,
      resultType,
      fieldConfig.type,
      errorOptions!,
      `Field ${parentTypeName}.${fieldConfig.name} must return an ObjectType when 'directResult' is set to true`,
      defaultGetResultName,
      defaultGetUnionName,
      errorBuilderOptions?.defaultResultOptions,
      errorBuilderOptions?.defaultUnionOptions,
    );

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        pothosErrors: errorTypes,
        pothosItemErrors: itemErrorTypes,
      },
      type: {
        kind: 'Union',
        ref: unionType,
        nullable: fieldConfig.type.nullable,
      },
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const pothosErrors = fieldConfig.extensions?.pothosErrors as (typeof Error)[] | undefined;
    const pothosItemErrors = fieldConfig.extensions?.pothosItemErrors as
      | (typeof Error)[]
      | undefined;

    if (!pothosErrors && !pothosItemErrors) {
      return resolver;
    }

    return async (source, args, context, info) => {
      if (fieldConfig.kind === 'Subscription' && errorTypeMap.has(source as {})) {
        return source;
      }

      try {
        const result = (await resolver(source, args, context, info)) as never;

        if (pothosItemErrors && result && typeof result === 'object' && Symbol.iterator in result) {
          return yieldErrors(result, pothosItemErrors);
        }

        if (
          pothosItemErrors &&
          result &&
          typeof result === 'object' &&
          Symbol.asyncIterator in result
        ) {
          console.log(result, yieldAsyncErrors);
          return yieldAsyncErrors(result, pothosItemErrors);
        }

        return result;
      } catch (error: unknown) {
        return wrapOrThrow(error, pothosErrors ?? []);
      }
    };
  }

  override wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const pothosErrors = fieldConfig.extensions?.pothosErrors as (typeof Error)[] | undefined;

    if (!pothosErrors) {
      return subscribe;
    }

    return (...args) => {
      async function* yieldSubscribeErrors() {
        try {
          const iter = (await subscribe(...args)) as AsyncIterableIterator<unknown>;

          if (!iter) {
            return iter;
          }

          for await (const value of iter) {
            yield value;
          }
        } catch (error: unknown) {
          yield wrapOrThrow(error, pothosErrors ?? []);
        }
      }

      return yieldSubscribeErrors();
    };
  }

  createResultType(
    parentTypeName: string,
    fieldName: string,
    type: TypeParam<Types>,
    fieldType: PothosOutputFieldType<Types>,
    errorOptions: ErrorFieldOptions<Types, TypeParam<Types>, unknown, false>,
    directResultError: string,
    defaultResultName: GetTypeName,
    defaultUnionName: GetTypeName,
    builderResultOptions: Normalize<
      Omit<PothosSchemaTypes.ObjectTypeOptions<Types, {}>, 'interfaces' | 'isTypeOf'> & {
        name?: GetTypeName;
      }
    > = {} as never,
    builderUnionOptions: Normalize<
      Omit<PothosSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
        name?: GetTypeName;
      }
    > = {} as never,
  ) {
    const errorBuilderOptions = this.builder.options.errors;
    const { name: getResultName = defaultResultName, ...defaultResultOptions } =
      builderResultOptions ?? {};
    const { name: getUnionName = defaultUnionName, ...defaultUnionOptions } =
      builderUnionOptions ?? {};

    const {
      types = [],
      result: {
        name: resultName = getResultName({
          parentTypeName,
          fieldName,
        }),
        fields: resultFieldOptions,
        ...resultObjectOptions
      } = {} as never,
      union: {
        name: unionName = getUnionName({
          parentTypeName,
          fieldName,
        }),
        ...unionOptions
      } = {} as never,
      dataField: { name: dataFieldName = 'data', ...dataField } = {} as never,
    } = errorOptions;

    const errorTypes = sortClasses([
      ...new Set([...types, ...(errorBuilderOptions?.defaultTypes ?? [])]),
    ]);

    const directResult =
      (errorOptions as { directResult?: boolean }).directResult ??
      errorBuilderOptions?.directResult ??
      false;

    const typeRef = unwrapOutputFieldType(fieldType);
    const typeName = this.builder.configStore.getTypeConfig(typeRef).name;

    return this.runUnique(resultName, () => {
      let resultType: ImplementableObjectRef<Types, unknown>;
      if (directResult && !Array.isArray(fieldType)) {
        resultType = type as ImplementableObjectRef<Types, unknown>;

        const resultConfig = this.builder.configStore.getTypeConfig(resultType);

        if (resultConfig.graphqlKind !== 'Object') {
          throw new PothosSchemaError(directResultError);
        }
      } else {
        resultType = this.builder.objectRef<unknown>(resultName);

        resultType.implement({
          ...defaultResultOptions,
          ...resultObjectOptions,
          fields: (t) => ({
            ...resultFieldOptions?.(t),
            [dataFieldName]: t.field({
              ...dataField,
              type,
              nullable:
                fieldType.kind === 'List' ? { items: fieldType.type.nullable, list: false } : false,
              resolve: (data) => data as never,
            }),
          }),
        });
      }

      const getDataloader = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldType))
        .extensions?.getDataloader;

      return this.builder.unionType(unionName, {
        types: [...errorTypes, resultType],
        resolveType: (obj) => (errorTypeMap.get(obj as {}) as never) ?? resultType,
        ...defaultUnionOptions,
        ...unionOptions,
        extensions: {
          ...unionOptions.extensions,
          getDataloader,
          pothosIndirectInclude: {
            getType: () => typeName,
            path: directResult ? [] : [{ type: resultName, name: dataFieldName }],
          },
        },
      });
    });
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosErrorsPlugin, {
  v3: (options) => ({
    errorOptions: undefined,
    errors: options?.errorOptions,
  }),
});

function wrapOrThrow(error: unknown, pothosErrors: ErrorConstructor[]) {
  for (const errorType of pothosErrors) {
    if (error instanceof errorType) {
      const result = createErrorProxy(error, errorType, { wrapped: true });

      errorTypeMap.set(result, errorType);

      return result;
    }
  }

  throw error;
}

function* yieldErrors(result: Iterable<unknown>, pothosErrors: ErrorConstructor[]) {
  try {
    for (const item of result) {
      if (item instanceof Error) {
        yield wrapOrThrow(item, pothosErrors);
      } else {
        yield item;
      }
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors);
  }
}

async function* yieldAsyncErrors(result: AsyncIterable<unknown>, pothosErrors: ErrorConstructor[]) {
  try {
    for await (const item of result) {
      if (item instanceof Error) {
        yield wrapOrThrow(item, pothosErrors);
      } else {
        yield item;
      }
    }
  } catch (error: unknown) {
    yield wrapOrThrow(error, pothosErrors);
  }
}
