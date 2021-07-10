import '@giraphql/plugin-directives';
import SchemaBuilder, {
  FieldBuilder,
  FieldMap,
  InterfaceParam,
  ObjectParam,
  ObjectRef,
  ObjectTypeOptions,
  OutputShape,
  ParentShape,
  RootFieldBuilder,
  SchemaTypes,
} from '@giraphql/core';
import {
  EntityObjectOptions,
  ExternalEntityOptions,
  Selection,
  SelectionFromShape,
  selectionShapeKey,
} from '.';

const schemaBuilderProto =
  SchemaBuilder.prototype as GiraphQLSchemaTypes.SchemaBuilder<SchemaTypes>;

type DirectiveList = { name: string; args?: {} }[];
type DirectiveOption = DirectiveList | Record<string, {}>;

export function keyDirective(key: Selection<object> | Selection<object>[]): {
  name: string;
  args?: {};
}[] {
  if (Array.isArray(key)) {
    return key.map(({ selection }) => ({
      name: 'key',
      args: { fields: selection },
    }));
  }

  return [
    {
      name: 'key',
      args: { fields: key.selection },
    },
  ];
}

export function mergeDirectives(
  existing: DirectiveOption | undefined,
  add: DirectiveList,
): DirectiveList {
  if (!existing) {
    return [...add];
  }

  if (Array.isArray(existing)) {
    return [...existing, ...add];
  }

  return [...Object.keys(existing).map((name) => ({ name, args: existing[name] })), ...add];
}

schemaBuilderProto.selection = <Shape extends object>(selection: SelectionFromShape<Shape>) => ({
  selection,
  [selectionShapeKey]: {} as unknown as Shape,
});

schemaBuilderProto.entity = function entity<
  Interfaces extends InterfaceParam<SchemaTypes>[],
  Param extends ObjectParam<SchemaTypes>,
  KeySelection extends Selection<object>,
>(
  param: Param,
  {
    key,
    directives,
    fields,
    ...options
  }: EntityObjectOptions<SchemaTypes, Param, Interfaces, KeySelection>,
): ObjectRef<OutputShape<SchemaTypes, Param>, ParentShape<SchemaTypes, Param>> {
  const mergedDirectives: {} = {
    directives: mergeDirectives(directives as [], keyDirective(key)) as [],
  };

  const ref = this.objectType(param, {
    ...mergedDirectives,
    ...(options as {} as ObjectTypeOptions<
      SchemaTypes,
      Param,
      ParentShape<SchemaTypes, Param>,
      Interfaces
    >),
  });

  this.objectFields(ref, (t) => ({
    ...fields?.(new FieldBuilder(t.typename, this, 'EntityObject', 'Object') as never),
  }));

  return ref;
};

schemaBuilderProto.externalEntity = function externalEntity<
  Name extends string,
  Fields extends FieldMap,
  KeySelection extends Selection<object>,
>(
  name: Name,
  {
    key,
    externalFields,
    fields,
    directives,
    ...options
  }: ExternalEntityOptions<SchemaTypes, Fields, KeySelection>,
): ObjectRef<KeySelection[typeof selectionShapeKey] & { __typename: Name }> {
  const ref = this.objectRef<KeySelection[typeof selectionShapeKey] & { __typename: Name }>(name);

  this.objectType<[], ObjectRef<KeySelection[typeof selectionShapeKey] & { __typename: Name }>>(
    ref,
    {
      directives: mergeDirectives(directives as [], keyDirective(key)) as [],
      ...(options as {} as ObjectTypeOptions<
        SchemaTypes,
        ObjectParam<SchemaTypes>,
        KeySelection[typeof selectionShapeKey] & { __typename: Name },
        []
      >),
      fields: (t) => ({
        ...fields?.(new FieldBuilder(name, this, 'ExtendedEntity', 'Object') as never),
        ...externalFields?.(new RootFieldBuilder(name, this, 'ExternalEntity', 'Object') as never),
      }),
    },
  );

  return ref;
};
