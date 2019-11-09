/* eslint-disable @typescript-eslint/consistent-type-assertions */
import { GraphQLFieldConfig, GraphQLFieldConfigArgumentMap, GraphQLNonNull } from 'graphql';
import fromEntries from 'object.fromentries';
import { TypeParam, InputFields, ShapeFromTypeParam, NamedTypeParam } from './types';
import TypeStore from './store';
import { typeFromParam, buildArg } from './utils';
import BaseType from './base';

export default class Field<
  Args extends InputFields<Types>,
  Types extends SpiderSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Nullable extends boolean = true,
  Extends extends string | null = null,
  Options extends SpiderSchemaTypes.FieldOptions<
    Types,
    ParentType,
    Type,
    Nullable,
    Args
  > = SpiderSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, Args>
> {
  shape?: ShapeFromTypeParam<Types, Type, true>;

  nullable: Nullable;

  args: Args = {} as Args;

  extendsField: Extends;

  type: Type;

  options: Options;

  gates: string[];

  parentTypename: NamedTypeParam<Types>;

  constructor(
    options: Options & {
      extendsField?: Extends;
    },
    parentTypename: NamedTypeParam<Types>,
  ) {
    this.options = options;
    this.nullable = (options.nullable === true ? options.nullable : false) as Nullable;
    this.args = options.args ? options.args! : ({} as Args);
    this.extendsField = options.extendsField || (null as Extends);
    this.type = options.type;
    this.gates = options.gates || [];
    this.parentTypename = parentTypename;
  }

  // private wrapResolve(store: TypeStore<Types>) {
  //   const parentType = store.getType(this.parentTypename);
  //   const checks = parentType.kind === 'Object' ? parentType.permissions : {};

  //   return (async (
  //     parent: ShapeFromTypeParam<Types, ParentType, false>,
  //     args: Args,
  //     context: Context,
  //     info: GraphQLResolveInfo,
  //   ) => {
  //     if (this.gates.length !== 0) {
  //       const permissions = await Promise.all(
  //         this.gates.map(gate => {
  //           if (checks[gate]) {
  //             return checks[gate](parent as Parameters<(typeof checks)[string]>[0], context);
  //           }
  //           return false;
  //         }),
  //       );

  //       if (permissions.filter(Boolean).length === 0) {
  //         throw new Error('unauthorized');
  //       }
  //     }

  //     return (this.options.resolve || defaultFieldResolver)(
  //       parent,
  //       args as InputShapeFromFields<Types, Args, null | undefined>,
  //       context,
  //       info,
  //     );
  //   }) as (...args: unknown[]) => Promise<unknown>;
  // }

  private buildArgs(store: TypeStore<Types>): GraphQLFieldConfigArgumentMap {
    return fromEntries(
      Object.keys(this.args).map(key => {
        const arg = this.args[key];

        return [
          key,
          {
            description:
              typeof arg !== 'object' || arg instanceof BaseType || Array.isArray(arg)
                ? undefined
                : arg.description,
            required:
              typeof arg !== 'object' || arg instanceof BaseType || Array.isArray(arg)
                ? false
                : arg.required || false,
            type: buildArg(arg, store),
          },
        ];
      }),
    );
  }

  build(name: string, store: TypeStore<Types>): GraphQLFieldConfig<unknown, unknown> {
    return {
      args: this.buildArgs(store),
      extensions: [],
      description: this.options.description || name,
      resolve: this.options.resolve as ((...args: unknown[]) => unknown),
      type: this.nullable
        ? typeFromParam(this.type, store)
        : new GraphQLNonNull(typeFromParam(this.type, store)),
    };
  }
}
