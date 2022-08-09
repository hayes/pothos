import { GraphQLResolveInfo } from 'graphql';
import {
  FieldBuilder,
  InterfaceParam,
  MaybePromise,
  ObjectRef,
  OutputTypeRef,
  RootFieldBuilder,
  SchemaTypes,
} from '@pothos/core';
import type {
  ExternalEntityOptions,
  Selection,
  SelectionFromShape,
  selectionShapeKey,
} from './types';
import { keyDirective, mergeDirectives } from './util';

export const providesMap = new WeakMap<{}, string>();

export class ExternalEntityRef<
  Types extends SchemaTypes,
  Shape extends object,
  Key extends Selection<object>,
> extends OutputTypeRef<Shape> {
  override kind = 'Object' as const;

  private builder: PothosSchemaTypes.SchemaBuilder<Types>;
  private key: Key | Key[];
  private resolveReference?: (
    parent: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<Shape | null | undefined>;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    key: Key | Key[],
    resolveReference?: (
      parent: Key[typeof selectionShapeKey],
      context: Types['Context'],
      info: GraphQLResolveInfo,
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
    this.builder.objectType(this as unknown as ObjectRef<unknown>, {
      ...(options as {} as PothosSchemaTypes.ObjectTypeOptions<Types, Shape>),
      name: this.name,
      directives: mergeDirectives(directives as [], [
        ...keyDirective(this.key),
        { name: 'extends', args: {} },
      ]) as [],
      fields: (t) => ({
        ...externalFields?.(
          new RootFieldBuilder(this.name, this.builder, 'ExternalEntity', 'Object') as never,
        ),
        ...fields?.(new FieldBuilder(this.name, this.builder, 'ExtendedEntity', 'Object') as never),
      }),
      extensions: {
        ...options.extensions,
        apollo: {
          ...(options.extensions?.apollo as {}),
          subgraph: {
            ...(options.extensions?.apollo as { subgraph: {} })?.subgraph,
            resolveReference: this.resolveReference,
          },
        },
      },
    });

    return this;
  }

  provides<T extends object>(selection: SelectionFromShape<T>) {
    const ref = Object.create(this) as ExternalEntityRef<Types, Shape & T, Key>;

    providesMap.set(ref, selection);
    this.builder.configStore.associateRefWithName(ref, this.name);

    return ref;
  }
}
