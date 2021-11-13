import {
  FieldBuilder,
  InterfaceParam,
  MaybePromise,
  ObjectRef,
  OutputTypeRef,
  RootFieldBuilder,
  SchemaTypes,
} from '@giraphql/core';
import { keyDirective, mergeDirectives } from './schema-builder';
import { ExternalEntityOptions, Selection, selectionShapeKey } from '.';

export class ExternalEntityRef<
  Types extends SchemaTypes,
  Shape extends object,
  Key extends Selection<object>,
> extends OutputTypeRef<Shape> {
  override kind: 'Object' = 'Object';

  private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;
  private key: Key | Key[];
  private resolveReference?: (parent: object) => MaybePromise<Shape | null | undefined>;

  constructor(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
    name: string,
    key: Key | Key[],
    resolveReference?: (
      parent: Key[typeof selectionShapeKey],
    ) => MaybePromise<Shape | null | undefined>,
  ) {
    super('Object', name);

    this.builder = builder;
    this.key = key;
    this.resolveReference = resolveReference;
  }

  implement<Interfaces extends InterfaceParam<Types>[]>({
    fields,
    externalFields,
    directives,
    ...options
  }: ExternalEntityOptions<Types, Shape, Interfaces>) {
    this.builder.objectType(this as ObjectRef<Shape>, {
      ...(options as {} as GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>),
      name: this.name,
      directives: mergeDirectives(directives as [], [
        ...keyDirective(this.key),
        { name: 'extends', args: {} },
      ]) as [],
      fields: (t) => ({
        ...fields?.(new FieldBuilder(this.name, this.builder, 'ExtendedEntity', 'Object') as never),
        ...externalFields?.(
          new RootFieldBuilder(this.name, this.builder, 'ExternalEntity', 'Object') as never,
        ),
      }),
      extensions: {
        ...options.extensions,
        resolveReference: this.resolveReference,
      },
    });

    return this;
  }
}
