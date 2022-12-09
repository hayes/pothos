import './global-types';
import { GraphQLFieldResolver, GraphQLIsTypeOfFn } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ImplementableObjectRef,
  PothosObjectTypeConfig,
  PothosOutputFieldConfig,
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

export const getTypeName: GetTypeName = ({ parentTypeName, fieldName, kind }) => `${parentTypeName}${fieldName}${kind}`


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

    const errorBuilderOptions = this.builder.options.errorOptions;

    if (!errorOptions) {
      return fieldConfig;
    }

    /**
     * NOTES
     * An argument on builder to configure output type names could work, but we need to figure which argument it would need.
     * 1. Are all names build using a similar template? in this case it's `${operationType}${fieldName}${SomePostFix}`
     *    - If they are, we could easily make this function global, if not, it may have to be per plugin instead?
     */
    const getNameFn = errorBuilderOptions?.defaultGetTypeName ?? getTypeName
    const parentTypeName = this.buildCache.getTypeConfig(fieldConfig.parentType).name;

    const {
      types = [],
      result: {
        name: resultName = getNameFn({parentTypeName, fieldName: capitalize(fieldConfig.name), kind: 'Success'}),
        fields: resultFieldOptions,
        ...resultObjectOptions
      } = {} as never,
      union: {
        name: unionName = getNameFn({parentTypeName, fieldName: capitalize(fieldConfig.name), kind: 'Result'}),
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
          throw new TypeError(
            `Field ${parentTypeName}.${fieldConfig.name} must return an ObjectType when 'directResult' is set to true`,
          );
        }
      } else {
        resultType = this.builder.objectRef<unknown>(resultName);

        resultType.implement({
          ...errorBuilderOptions?.defaultResultOptions,
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
        ...errorBuilderOptions?.defaultUnionOptions,
        ...unionOptions,
        extensions: {
          ...unionOptions.extensions,
          getDataloader,
          pothosPrismaIndirectInclude: {
            getType: () => typeName,
            path: [{ type: resultName, name: dataFieldName }],
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
    const pothosErrors = fieldConfig.extensions?.pothosErrors as typeof Error[] | undefined;

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

SchemaBuilder.registerPlugin(pluginName, PothosErrorsPlugin);
