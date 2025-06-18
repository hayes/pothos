import {
  completeValue,
  type InterfaceRef,
  ObjectFieldBuilder,
  type ObjectParam,
  type ObjectRef,
  type OutputRef,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { NodeRefOptions } from '../types';

export function addNodeProperties<Types extends SchemaTypes, T, P = T, IDShape = string>(
  name: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ref: ObjectRef<Types, unknown>,
  param: ObjectParam<Types> | undefined,
  options: NodeRefOptions<Types, T, P, IDShape>,
) {
  ref.addInterfaces([
    (
      builder as typeof builder & { nodeInterfaceRef: () => InterfaceRef<Types, {}> }
    ).nodeInterfaceRef(),
  ]);

  ref.addFields(() => ({
    [builder.options.relay?.idFieldName ?? 'id']: new ObjectFieldBuilder<SchemaTypes, P>(
      builder as never,
    ).globalID({
      nullable: false,
      ...builder.options.relay?.idFieldOptions,
      ...options.id,
      args: {},
      resolve: (parent, args, context, info) =>
        completeValue(options.id.resolve(parent, args, context, info), (globalId) => ({
          type: name,
          id: globalId,
        })),
    }),
  }));

  ref.updateConfig(({ extensions, isTypeOf, pothosOptions, ...config }) => {
    return {
      ...config,
      extensions: {
        ...extensions,
        pothosParseGlobalID: options.id.parse,
      },
      pothosOptions: {
        ...(options as {}),
        ...(pothosOptions as {}),
      },
      isTypeOf:
        isTypeOf ??
        (typeof param === 'function'
          ? (maybeNode: unknown, _context: object, _info: GraphQLResolveInfo) => {
              if (!maybeNode) {
                return false;
              }

              if (maybeNode instanceof (param as Function)) {
                return true;
              }

              const proto = Object.getPrototypeOf(maybeNode) as { constructor: unknown };

              try {
                if (proto?.constructor) {
                  const config = builder.configStore.getTypeConfig(proto.constructor as OutputRef);

                  return config.name === name;
                }
              } catch {
                // ignore
              }

              return false;
            }
          : undefined),
    };
  });
}
