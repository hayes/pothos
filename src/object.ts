import { GraphQLObjectType } from 'graphql';
import BaseType from './base';
import {
  TypeMap,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  ObjectShapeFromInterfaces,
  CompatibleInterfaceNames,
} from './types';
import InterfaceType from './interface';
import FieldBuilder from './fieldBuilder';

export default class ObjectType<
  Types extends TypeMap,
  Type extends Extract<keyof Types, string>,
  ParentShape extends ObjectShapeFromInterfaces<Types, Interfaces>,
  Shape extends ParentShape,
  Context,
  Interfaces extends InterfaceType<
    Types,
    CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
    {},
    {},
    {}
  >[]
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  name: Type;

  description?: string;

  fieldBuilder: FieldBuilder<Shape, Types, Type, Context>;

  constructor(
    name: Type,
    options: ObjectTypeOptions<Types, Type, ParentShape, Shape, Context, Interfaces>,
  ) {
    super(name as string);

    this.name = name;
    this.description = options.description;
    this.fieldBuilder =
      typeof options.shape === 'function' ? options.shape({} as any) : options.shape;
  }

  build() {
    return new GraphQLObjectType({
      name: this.name,
      description: this.description,
      fields: this.fieldBuilder.build(),
    });
  }
}
