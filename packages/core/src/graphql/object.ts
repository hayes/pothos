import { GraphQLObjectType } from 'graphql';
// @ts-ignore
import fromEntries from 'object.fromentries';
import BaseType from './base';
import {
  ShapeFromTypeParam,
  CompatibleInterfaceNames,
  TypeParam,
  UnionToIntersection,
  NullableToOptional,
  FieldMap,
  ObjectName,
} from '../types';
import InterfaceType from './interface';
import Field from './field';
import FieldBuilder from '../fieldUtils/builder';
import BasePlugin from '../plugin';
import BuildCache from '../build-cache';

export default class ObjectType<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Name, false>>
  >[],
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends ObjectName<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, false>> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: Interfaces;

  options: NullableToOptional<GiraphQLSchemaTypes.ObjectTypeOptions<{}, Interfaces, Types, Name>>;

  constructor(
    name: Name,
    options: NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<Shape, Interfaces, Types, Name>
    >,
  ) {
    super(name);

    if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
      throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
    }

    this.options = options;
    this.description = options.description;
    this.interfaces = options.implements || (([] as unknown) as Interfaces);
  }

  getFields(
    parentFields: UnionToIntersection<NonNullable<Interfaces[number]['fieldShape']>> & {},
  ): FieldMap<Types> {
    return this.options.shape(new FieldBuilder(parentFields, this.typename));
  }

  buildType(cache: BuildCache<Types>, plugins: BasePlugin<Types>[]): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      interfaces: () =>
        this.interfaces.map(type => cache.getEntryOfType(type.typename, 'Interface').built),
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
