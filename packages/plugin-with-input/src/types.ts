import {
  ArgumentRef,
  FieldKind,
  FieldNullability,
  FieldOptionsFromKind,
  InputFieldMap,
  InputFieldRef,
  InputRef,
  InputShapeFromFields,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';

export interface WithInputBuilderOptions<Types extends SchemaTypes> {
  argOptions?: Omit<
    PothosSchemaTypes.ArgFieldOptions<Types, InputRef<{}>, true>,
    'required' | 'type'
  > & {
    required?: Types['WithInputArgRequired'];
  };
  typeOptions?: Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, {}>, 'fields'> & {
    name?: (options: { parentTypeName: string; fieldName: string }) => string;
  };
}

export type WithInputInputOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  InputName extends string,
> = Omit<PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>, 'fields'> & {
  name?: string;
  argName?: InputName;
  inputFields: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'InputObject'>) => Fields;
};

export type WithInputTypeOptions<Types extends SchemaTypes, Fields extends InputFieldMap> = Omit<
  PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>,
  'fields'
> & {
  name?: string;
};

export type WithInputArgOptions<
  Types extends SchemaTypes,
  Fields extends InputFieldMap,
  InputName,
  ArgRequired extends boolean,
> = Omit<
  PothosSchemaTypes.ArgFieldOptions<Types, InputRef<InputShapeFromFields<Fields>>, ArgRequired>,
  'type'
> & {
  name?: InputName;
};

export type FieldWithInputOptions<
  Types extends SchemaTypes,
  ParentShape,
  Kind extends FieldKind,
  Args extends Record<string, ArgumentRef<Types, unknown>>,
  Fields extends Record<string, InputFieldRef<Types, unknown>>,
  Type extends TypeParam<Types>,
  Nullable extends FieldNullability<Type>,
  InputName extends string,
  ResolveShape,
  ResolveReturnShape,
  ArgRequired extends boolean,
> = Omit<
  FieldOptionsFromKind<
    Types,
    ParentShape,
    Type,
    Nullable,
    Args & {
      [K in InputName]: InputFieldRef<
        Types,
        InputShapeFromFields<Fields> | (true extends ArgRequired ? never : null | undefined)
      >;
    },
    Kind,
    ResolveShape,
    ResolveReturnShape
  >,
  'args'
> & {
  typeOptions?: WithInputTypeOptions<Types, Fields>;
  argOptions?: WithInputArgOptions<Types, Fields, InputName, ArgRequired>;
  input: Fields;
  args?: Args;
};
