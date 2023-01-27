import SchemaBuilder, {
  BaseTypeRef,
  EnumRef,
  InputFieldRef,
  InputObjectRef,
  InputRef,
  InputShapeFromTypeParam,
  InputType,
  PothosSchemaError,
  SchemaTypes,
} from '@pothos/core';
import { getModel, PrismaModelTypes } from '@pothos/plugin-prisma';
import {
  FilterListOps,
  FilterOps,
  FilterShape,
  OpsOptions,
  PrismaCreateManyRelationOptions,
  PrismaCreateOneRelationOptions,
  PrismaCreateOptions,
  PrismaFilterOptions,
  PrismaListFilterOptions,
  PrismaOrderByOptions,
  PrismaUpdateManyRelationOptions,
  PrismaUpdateOneRelationOptions,
  PrismaUpdateOptions,
  PrismaWhereOptions,
  PrismaWhereUniqueOptions,
} from './types';

export const schemaBuilder =
  SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

const OrderByRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  EnumRef<'asc' | 'desc'>
>();

schemaBuilder.prismaFilter = function prismaFilter<
  Type extends InputType<SchemaTypes>,
  Ops extends OpsOptions<SchemaTypes, Type, FilterOps>,
>(type: Type, { ops, name, ...options }: PrismaFilterOptions<SchemaTypes, Type, Ops>) {
  const filterName = name ?? `${nameFromType(type, this)}Filter`;
  const ref =
    this.inputRef<
      Pick<
        FilterShape<InputShapeFromTypeParam<SchemaTypes, Type, true>>,
        Ops extends readonly string[] ? Ops[number] : keyof Ops
      >
    >(filterName);

  const opsOptions: Record<string, unknown> = Array.isArray(ops)
    ? ((ops as string[]).reduce<Record<string, {}>>((map, op) => {
        // eslint-disable-next-line no-param-reassign
        map[op] = {};
        return map;
      }, {}) as {})
    : ops;

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fields: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      for (const op of Object.keys(opsOptions)) {
        const isList = op === 'in' || op === 'notIn';
        let fieldType: InputType<SchemaTypes> | [InputType<SchemaTypes>] = type;

        if (op === 'not') {
          fieldType = ref;
        } else if (op === 'in' || op === 'notIn') {
          fieldType = [type];
        }

        fields[op] = t.field({
          required: isList ? { list: false, items: true } : false,
          type: fieldType,
          ...(opsOptions[op] as {}),
        });
      }

      return fields as never;
    },
  });

  return ref as never;
};

schemaBuilder.prismaListFilter = function prismaListFilter<
  Type extends InputType<SchemaTypes>,
  Ops extends OpsOptions<SchemaTypes, Type, FilterListOps>,
>(type: Type, { name, ops, ...options }: PrismaListFilterOptions<SchemaTypes, Type, Ops>) {
  let filterName = name;

  if (!filterName) {
    const typeName = nameFromType(type, this);

    filterName = typeName.endsWith('Filter')
      ? typeName.replace(/Filter$/, 'ListFilter')
      : `List${typeName}`;
  }

  const ref = this.inputRef(filterName);
  const opsOptions: Record<string, unknown> = Array.isArray(ops)
    ? ((ops as readonly string[]).reduce<Record<string, {}>>((map, op) => {
        // eslint-disable-next-line no-param-reassign
        map[op] = {};
        return map;
      }, {}) as {})
    : ops;

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fields: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      for (const op of Object.keys(opsOptions)) {
        fields[op] = t.field({
          required: false,
          type,
          ...(opsOptions[op] as {}),
        });
      }

      return fields as never;
    },
  });

  return ref as never;
};

schemaBuilder.orderByEnum = function orderByEnum() {
  if (OrderByRefMap.has(this)) {
    return OrderByRefMap.get(this)!;
  }

  const ref = this.enumType('OrderBy', {
    values: {
      Asc: { value: 'asc' as const },
      Desc: { value: 'desc' as const },
    },
  });

  OrderByRefMap.set(this, ref);

  return ref;
};

schemaBuilder.prismaOrderBy = function prismaOrderBy<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
>(type: Name, { name, fields, ...options }: PrismaOrderByOptions<SchemaTypes, Model>) {
  const filterName = name ?? `${nameFromType(type, this)}OrderBy`;
  const ref = this.inputRef<InputRef<Model['OrderBy']>>(filterName);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      const fieldMap = typeof fields === 'function' ? fields() : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap];

        if (typeof fieldOption === 'function') {
          const { type: fieldType, ...fieldOptions } = (
            fieldOption as () => PothosSchemaTypes.InputFieldOptions<SchemaTypes>
          )();

          fieldDefs[field] = t.field({
            required: false,
            ...fieldOptions,
            type: fieldType,
          });
        } else if (typeof fieldOption === 'boolean') {
          fieldDefs[field] = t.field({
            required: false,
            type: this.orderByEnum(),
          });
        } else {
          fieldDefs[field] = t.field({
            required: false,
            type: fieldOption as InputRef<unknown>,
          });
        }
      });

      return fieldDefs as never;
    },
  });

  return ref as InputObjectRef<Model['OrderBy']>;
};

schemaBuilder.prismaWhere = function prismaWhere<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
  Fields = {},
>(
  type: Name,
  { name, fields, ...options }: PrismaWhereOptions<SchemaTypes, Model, Fields>,
): InputObjectRef<Model['Where']> {
  const ref = this.inputRef<Model['Where']>(name ?? `${nameFromType(type, this)}Filter`);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        if (field === 'AND' || field === 'OR' || field === 'NOT') {
          fieldDefs[field] = t.field({
            required: false,
            type: field === 'NOT' ? ref : [ref],
            ...(typeof fieldOption === 'object' ? fieldOption : {}),
          });

          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
            : t.field({
                required: false,
                type: fieldOption as InputRef<unknown>,
              });
      });

      return fieldDefs as never;
    },
  });

  return ref;
};

schemaBuilder.prismaWhereUnique = function prismaWhereUnique<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
  Fields = {},
>(
  type: Name,
  { name, fields, ...options }: PrismaWhereUniqueOptions<SchemaTypes, Model, Fields>,
): InputObjectRef<Model['WhereUnique']> {
  const ref = this.inputRef<Model['WhereUnique']>(
    name ?? `${nameFromType(type, this)}UniqueFilter`,
  );

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
            : t.field({
                required: false,
                type: fieldOption as InputRef<unknown>,
              });
      });

      return fieldDefs as never;
    },
  });

  return ref;
};

schemaBuilder.prismaCreate = function prismaCreate<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
  Fields = {},
>(type: Name, { name, fields, ...options }: PrismaCreateOptions<SchemaTypes, Model, Fields>) {
  const ref = this.inputRef<Model['Create']>(name ?? `${nameFromType(type, this)}CreateInput`);
  const model = getModel(type, this);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldModel = model.fields.find(({ name: fieldName }) => fieldName === field)!;

        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
            : t.field({
                required:
                  fieldModel.isRequired &&
                  !fieldModel.isList &&
                  !fieldModel.hasDefaultValue &&
                  !fieldModel.isUpdatedAt,
                type:
                  fieldModel.isList && fieldModel.kind !== 'object'
                    ? [fieldOption as InputRef<unknown>]
                    : (fieldOption as InputRef<unknown>),
              });
      });

      return fieldDefs as never;
    },
  });

  return ref;
};

schemaBuilder.prismaUpdate = function prismaUpdate<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
  Fields = {},
>(type: Name, { name, fields, ...options }: PrismaUpdateOptions<SchemaTypes, Model, Fields>) {
  const ref = this.inputRef<Model['Update']>(name ?? `${nameFromType(type, this)}UpdateInput`);
  const model = getModel(type, this);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldModel = model.fields.find(({ name: fieldName }) => fieldName === field)!;
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
            : t.field({
                required: false,
                type:
                  fieldModel.isList && fieldModel.kind !== 'object'
                    ? [fieldOption as InputRef<unknown>]
                    : (fieldOption as InputRef<unknown>),
              });
      });

      return fieldDefs as never;
    },
  });

  return ref;
};

schemaBuilder.prismaCreateRelation = function prismaCreateRelation<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Relation extends Model['RelationName'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
>(
  type: Name,
  relation: Relation,
  {
    name,
    fields,
    ...options
  }: Relation extends Model['ListRelations']
    ? PrismaCreateManyRelationOptions<SchemaTypes, Relation, Model>
    : PrismaCreateOneRelationOptions<SchemaTypes, Relation, Model>,
) {
  const ref = this.inputRef(
    name ?? `${nameFromType(type, this)}Create${capitalize(relation)}RelationInput`,
  );

  const model = getModel(type, this);
  const fieldModel = model.fields.find((field) => field.name === relation)!;

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
            : t.field({
                required: false,
                type: fieldModel.isList
                  ? [fieldOption as InputRef<unknown>]
                  : (fieldOption as InputRef<unknown>),
              });
      });

      return fieldDefs as never;
    },
  });

  return ref as never;
};

schemaBuilder.prismaUpdateRelation = function prismaUpdateRelation<
  Name extends keyof SchemaTypes['PrismaTypes'],
  Relation extends Model['RelationName'],
  Model extends PrismaModelTypes = SchemaTypes['PrismaTypes'][Name] extends PrismaModelTypes
    ? SchemaTypes['PrismaTypes'][Name]
    : never,
>(
  type: Name,
  relation: Relation,
  {
    name,
    fields,
    ...options
  }: Relation extends Model['ListRelations']
    ? PrismaUpdateManyRelationOptions<SchemaTypes, Relation, Model>
    : PrismaUpdateOneRelationOptions<SchemaTypes, Relation, Model>,
) {
  const ref = this.inputRef(
    name ?? `${nameFromType(type, this)}Update${capitalize(relation)}RelationInput`,
  );

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;
      const model = getModel(type, this);
      const fieldModel = model.fields.find((field) => field.name === relation)!;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        if (fieldOption instanceof InputFieldRef) {
          fieldDefs[field] = fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>;
        } else if (fieldModel.isList && (field === 'update' || field === 'updateMany')) {
          const {
            name: nestedName = `${ref.name}U${field.slice(1)}`,
            where: whereType,
            data: dataType,
          } = fieldOption as {
            name?: string;
            where: InputRef<unknown> | InputFieldRef<SchemaTypes>;
            data: InputRef<unknown> | InputFieldRef<SchemaTypes>;
          };

          const nestedRef = this.inputType(nestedName, {
            fields: (t2) => ({
              where: whereType instanceof InputFieldRef ? whereType : t2.field({ type: whereType }),
              data: dataType instanceof InputFieldRef ? dataType : t2.field({ type: dataType }),
            }),
          });

          fieldDefs[field] = t.field({
            required: false,
            type: [nestedRef],
          });
        } else {
          fieldDefs[field] = t.field({
            required: false,
            type: fieldModel.isList
              ? [fieldOption as InputRef<unknown>]
              : (fieldOption as InputRef<unknown>),
          });
        }
      });

      return fieldDefs as never;
    },
  });

  return ref as never;
};

function nameFromType<Types extends SchemaTypes>(
  type: InputType<Types>,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) {
  if (typeof type === 'string') {
    return type;
  }

  if (builder.configStore.hasConfig(type)) {
    return builder.configStore.getTypeConfig(type).name;
  }

  if (typeof type === 'function' && 'name' in type) {
    return (type as { name: string }).name;
  }

  if (type instanceof BaseTypeRef) {
    return type.name;
  }

  throw new PothosSchemaError(`Unable to determine name for type ${String(type)}`);
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
