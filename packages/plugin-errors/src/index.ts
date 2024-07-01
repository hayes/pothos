import './global-types';
import { GraphQLFieldResolver, GraphQLIsTypeOfFn } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ImplementableObjectRef,
  PothosObjectTypeConfig,
  PothosOutputFieldConfig,
  PothosSchemaError,
  SchemaTypes,
  sortClasses,
  typeBrandKey,
  unwrapOutputFieldType,
} from '@pothos/core';
import { GetTypeName } from './types';

export * from './types';

const pluginName = 'errors';

export default pluginName;

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

export const defaultGetResultName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${fieldName}Success`;
export const defaultGetUnionName: GetTypeName = ({ parentTypeName, fieldName }) =>
  `${parentTypeName}${fieldName}Result`;

export const unwrapError = Symbol.for('Pothos.unwrapErrors');

function createErrorProxy(target: {}, ref: unknown, state: { wrapped: boolean }): {} {
  return new Proxy(target, {
    get(err, val, receiver) {
      if (val === unwrapError) {
        return () => {
          // eslint-disable-next-line no-param-reassign
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

const errorTypeMap = new WeakMap<{}, new (...args: any[]) => Error>();

export class PothosErrorsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    config: PothosObjectTypeConfig,
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

    const errorBuilderOptions = this.builder.options.errors;

    if (!errorOptions) {
      return fieldConfig;
    }

    const { name: getResultName = defaultGetResultName, ...defaultResultOptions } =
      errorBuilderOptions?.defaultResultOptions ?? {
        name: defaultGetResultName,
      };
    const { name: getUnionName = defaultGetUnionName, ...defaultUnionOptions } =
      errorBuilderOptions?.defaultUnionOptions ?? {
        name: defaultGetUnionName,
      };

    const parentTypeName = this.buildCache.getTypeConfig(fieldConfig.parentType).name;

    const {
      types = [],
      result: {
        name: resultName = getResultName({
          parentTypeName,
          fieldName: capitalize(fieldConfig.name),
        }),
        fields: resultFieldOptions,
        ...resultObjectOptions
      } = {} as never,
      union: {
        name: unionName = getUnionName({
          parentTypeName,
          fieldName: capitalize(fieldConfig.name),
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

    const typeRef = unwrapOutputFieldType(fieldConfig.type);

    const typeName = this.builder.configStore.getTypeConfig(typeRef).name;

    const unionType = this.runUnique(resultName, () => {
      let resultType: ImplementableObjectRef<Types, unknown>;
      if (directResult && !Array.isArray(fieldConfig.pothosOptions.type)) {
        resultType = fieldConfig.pothosOptions.type as ImplementableObjectRef<Types, unknown>;

        const resultConfig = this.builder.configStore.getTypeConfig(resultType);

        if (resultConfig.graphqlKind !== 'Object') {
          throw new PothosSchemaError(
            `Field ${parentTypeName}.${fieldConfig.name} must return an ObjectType when 'directResult' is set to true`,
          );
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
              type: fieldConfig.pothosOptions.type,
              nullable:
                fieldConfig.type.kind === 'List'
                  ? { items: fieldConfig.type.type.nullable, list: false }
                  : false,
              resolve: (data) => data as never,
            }),
          }),
        });
      }

      const getDataloader = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type))
        .extensions?.getDataloader;

      return this.builder.unionType(unionName, {
        types: [...errorTypes, resultType],
        resolveType: (obj) => errorTypeMap.get(obj as {}) ?? resultType,
        ...defaultUnionOptions,
        ...unionOptions,
        extensions: {
          ...unionOptions.extensions,
          getDataloader,
          pothosPrismaIndirectInclude: {
            getType: () => typeName,
            path: directResult ? [] : [{ type: resultName, name: dataFieldName }],
          },
        },
      });
    });

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        pothosErrors: errorTypes,
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

    if (!pothosErrors) {
      return resolver;
    }

    return async (...args) => {
      try {
        return (await resolver(...args)) as never;
      } catch (error: unknown) {
        for (const errorType of pothosErrors) {
          if (error instanceof errorType) {
            const result = createErrorProxy(error, errorType, { wrapped: true });

            errorTypeMap.set(result, errorType);

            return result;
          }
        }

        throw error;
      }
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosErrorsPlugin, {
  v3: (options) => ({
    errorOptions: undefined,
    errors: options?.errorOptions,
  }),
});
