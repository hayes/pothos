/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePlugin, InputFields, TypeParam, Field, TypeStore } from 'schema-builder';
import { GraphQLFieldConfig, GraphQLResolveInfo, defaultFieldResolver } from 'graphql';
import './global-types';

export default class AuthPlugin<Types extends SpiderSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  updateFieldConfig(
    field: Field<InputFields<Types>, Types, TypeParam<Types>, TypeParam<Types>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    store: TypeStore<Types>,
  ): GraphQLFieldConfig<unknown, unknown> {
    const parentType = store.getType(field.parentTypename);
    const checks = parentType.kind === 'Object' ? parentType.options.permissions || {} : {};

    const wrappedResolver = async (
      parent: unknown,
      args: unknown,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      console.log(field);

      if (field.options.gates && field.options.gates.length !== 0) {
        const permissions = await Promise.all(
          field.options.gates!.map(gate => {
            if (checks[gate]) {
              return checks[gate](parent as Parameters<(typeof checks)[string]>[0], context);
            }
            return false;
          }),
        );

        if (permissions.filter(Boolean).length === 0) {
          throw new Error('unauthorized');
        }
      }

      return (config.resolve || defaultFieldResolver)(parent, args as any, context, info);
    };

    return {
      ...config,
      resolve: wrappedResolver as (...args: unknown[]) => unknown,
    };
  }
}
