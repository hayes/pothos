import { GraphQLObjectType } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import {
  ShapeFromTypeParam,
  TypeParam,
  NullableToOptional,
  FieldMap,
  ObjectName,
  InterfaceName,
  CompatibleInterfaceParam,
} from '../types';
import Field from './field';
import FieldBuilder from '../fieldUtils/builder';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';
import { InterfaceType } from '..';

export default class ObjectType<
  Interfaces extends CompatibleInterfaceParam<Types, ShapeFromTypeParam<Types, Name, false>>[],
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends ObjectName<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, false>> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: InterfaceName<Types>[];

  options: NullableToOptional<
    GiraphQLSchemaTypes.ObjectTypeOptions<CompatibleInterfaceParam<Types, {}>[], Types, {}>
  >;

  constructor(
    name: Name,
    options: NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<
        Interfaces,
        Types,
        ShapeFromTypeParam<Types, Name, false>
      >
    >,
  ) {
    super(name);

    if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
      throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
    }

    this.options = (options as unknown) as NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<CompatibleInterfaceParam<Types, {}>[], Types, {}>
    >;

    this.description = options.description;
    this.interfaces = ((options.implements ?? []) as (
      | InterfaceType<Types, InterfaceName<Types>>
      | InterfaceName<Types>
    )[]).map(iface =>
      typeof iface === 'string'
        ? iface
        : (iface as InterfaceType<Types, InterfaceName<Types>>).typename,
    );
  }

  getFields(): FieldMap<Types> {
    return this.options.shape(new FieldBuilder(this.typename));
  }

  buildType(cache: BuildCache<Types>, plugins: BasePlugin<Types>[]): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      interfaces: () => this.interfaces.map(type => cache.getEntryOfType(type, 'Interface').built),
      fields: () =>
        fromEntries(
          Object.entries(cache.getFields(this.typename)).map(([key, field]) => [
            key,
            (field as Field<{}, Types, TypeParam<Types>, TypeParam<Types>>).build(
              key,
              cache,
              plugins,
            ),
          ]),
        ),
      extensions: this.options.extensions,
    });
  }
}
