import { GraphQLObjectType } from 'graphql';
import fromEntries from 'object.fromentries';
import BaseType from './base';
import {
  ShapeFromTypeParam,
  CompatibleInterfaceNames,
  NamedTypeParam,
  TypeParam,
  UnionToIntersection,
  NullableToOptional,
} from './types';
import InterfaceType from './interface';
import TypeStore from './store';
import Field from './field';
import FieldBuilder from './fieldUtils/builder';
import BasePlugin from './plugin';

export default class ObjectType<
  Shape extends {},
  Interfaces extends InterfaceType<
    {},
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Name, false>>
  >[],
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Name extends NamedTypeParam<Types>
> extends BaseType<Types, Name, ShapeFromTypeParam<Types, Name, false>> {
  kind: 'Object' = 'Object';

  description?: string;

  interfaces: Interfaces;

  fields: Shape;

  isType: (obj: unknown) => boolean;

  options: NullableToOptional<
    GiraphQLSchemaTypes.ObjectTypeOptions<Shape, Interfaces, Types, Name>
  >;

  // permissions: {
  //   [s: string]: (parent: any, context: any) => boolean | Promise<boolean>;
  // };

  constructor(
    name: Name,
    options: NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<Shape, Interfaces, Types, Name>
    >,
  ) {
    super(name);

    this.options = options;

    this.description = options.description;
    this.interfaces = options.implements || (([] as unknown) as Interfaces);

    this.isType = (options as ({ isType: (obj: unknown) => boolean })).isType || (() => false);

    // this.permissions = options.permissions || {};

    const parentFields = this.interfaces
      .map(i => i.fields)
      .reduce((fields, all) => ({ ...fields, ...all }), {}) as UnionToIntersection<
      Interfaces[number]['fields']
    > & {};

    this.fields = {
      ...(parentFields as {}),
      ...options.shape(new FieldBuilder(parentFields, this.typename)),
    };
  }

  buildType(store: TypeStore<Types>, plugins: BasePlugin<Types>[]): GraphQLObjectType {
    return new GraphQLObjectType({
      name: String(this.typename),
      description: this.description,
      interfaces: () =>
        this.interfaces.map(type => store.getEntryOfType(type.typename, 'Interface').built),
      fields: () =>
        fromEntries(
          Object.entries(this.fields).map(([key, field]) => [
            key,
            (field as Field<{}, Types, TypeParam<Types>, TypeParam<Types>>).build(
              key,
              store,
              plugins,
            ),
          ]),
        ),
    });
  }
}
