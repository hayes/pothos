import './global-types';
import { GraphQLFieldResolver } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ImplementableObjectRef,
  PothosOutputFieldConfig,
  SchemaTypes,
  sortClasses,
} from '@pothos/core';

export * from './types';

const pluginName = 'errors';

export default pluginName;

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}

function createErrorProxy(target: {}): {} {
  return new Proxy(target, {
    getPrototypeOf(err) {
      const proto = Object.getPrototypeOf(err) as {};

      if (!proto) {
        return proto;
      }

      return createErrorProxy(proto);
    },
  });
}

const errorTypeMap = new WeakMap<{}, new (...args: any[]) => Error>();

export class PothosErrorsPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    const errorOptions = fieldConfig.pothosOptions.errors;

    const errorBuilderOptions = this.builder.options.errorOptions;

    if (!errorOptions) {
      return fieldConfig;
    }

    const parentTypeName = this.buildCache.getTypeConfig(fieldConfig.parentType).name;
    const {
      types = [],
      result: {
        name: resultName = `${parentTypeName}${capitalize(fieldConfig.name)}Success`,
        fields: resultFieldOptions,
        ...resultObjectOptions
      } = {} as never,
      union: {
        name: unionName = `${parentTypeName}${capitalize(fieldConfig.name)}Result`,
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

    const typeRef =
      fieldConfig.type.kind === 'List' ? fieldConfig.type.type.ref : fieldConfig.type.ref;

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

      const type = fieldConfig.type.kind === 'List' ? fieldConfig.type.type : fieldConfig.type;
      const getDataloader = this.buildCache.getTypeConfig(type.ref).extensions?.getDataloader;

      return this.builder.unionType(unionName, {
        types: [...errorTypes, resultType],
        resolveType: (obj) => errorTypeMap.get(obj as {}) ?? resultType,
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
            const result = createErrorProxy(error);

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
