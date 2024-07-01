import { GraphQLResolveInfo } from 'graphql';
import {
  FieldBuilder,
  InterfaceParam,
  MaybePromise,
  ObjectRef,
  RootFieldBuilder,
  SchemaTypes,
} from '@pothos/core';
import type {
  ExternalEntityOptions,
  Selection,
  SelectionFromShape,
  selectionShapeKey,
} from './types';
import { addUsedDirectives, keyDirective, mergeDirectives } from './util';

export const providesMap = new WeakMap<{}, string>();

export class ExternalEntityRef<
  Types extends SchemaTypes,
  Shape extends object,
  Key extends Selection<object>,
> extends ObjectRef<Types, Shape> {
  override kind = 'Object' as const;

  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  private key?: Key | Key[];

  private resolveReference?: (
    parent: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ) => MaybePromise<Shape | null | undefined>;

  constructor(
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
    name: string,
    {
      key,
      resolveReference,
    }: {
      key?: Key | Key[];
      resolveReference?: (
        parent: Key[typeof selectionShapeKey],
        context: Types['Context'],
        info: GraphQLResolveInfo,
      ) => MaybePromise<Shape | null | undefined>;
    },
  ) {
    super(name);

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
    addUsedDirectives(this.builder, ['extends', 'key']);
    this.builder.objectType(this as unknown as ObjectRef<Types, unknown>, {
      ...(options as {} as PothosSchemaTypes.ObjectTypeOptions<Types, Shape>),
      name: this.name,
      directives: mergeDirectives(directives as [], [
        ...(this.key ? keyDirective(this.key) : []),
        { name: 'extends', args: {} },
      ]) as [],
      fields: (t) => ({
        ...externalFields?.(
          new RootFieldBuilder(this.builder, 'ExternalEntity', 'Object') as never,
        ),
        ...fields?.(new FieldBuilder(this.builder, 'ExtendedEntity', 'Object') as never),
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
    this.builder.configStore.associateParamWithRef(ref, this);

    return ref;
  }
}
