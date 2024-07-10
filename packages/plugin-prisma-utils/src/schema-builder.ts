import SchemaBuilder, {
  BaseTypeRef,
  EnumRef,
  InputFieldMap,
  InputFieldRef,
  InputObjectRef,
  InputRef,
  InputShapeFromTypeParam,
  InputType,
  InputTypeParam,
  PothosSchemaError,
  SchemaTypes,
} from '@pothos/core';
import { getModel, PrismaModelTypes } from '@pothos/plugin-prisma';
import {
  FilterListOps,
  FilterOps,
  FilterShape,
  IntFieldUpdateOperationsInput,
  OpsOptions,
  PrismaCreateManyRelationOptions,
  PrismaCreateOneRelationOptions,
  PrismaCreateOptions,
  PrismaFilterOptions,
  PrismaListFilterOptions,
  PrismaOrderByOptions,
  PrismaScalarListFilterOptions,
  PrismaUpdateManyRelationOptions,
  PrismaUpdateOneRelationOptions,
  PrismaUpdateOptions,
  PrismaWhereOptions,
  PrismaWhereUniqueOptions,
  ScalarListOps,
} from './types';

export const schemaBuilder =
  SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

const OrderByRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  EnumRef<SchemaTypes, 'asc' | 'desc'>
>();

const PrismaStringFilterModeRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  EnumRef<SchemaTypes, 'default' | 'insensitive'>
>();

const nullableOps = new Set(['equals', 'is', 'isNot', 'not']);

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
      pothosPrismaInput: { nullableFields: nullableOps },
    },
    fields: (t) => {
      const fields: InputFieldMap = {};

      for (const op of Object.keys(opsOptions)) {
        const isList = op === 'in' || op === 'notIn';
        let fieldType: InputType<SchemaTypes> | [InputType<SchemaTypes>];

        switch (op) {
          case 'not':
            fieldType = ref;
            break;
          case 'in':
          case 'notIn':
            fieldType = [type];
            break;
          case 'mode':
            fieldType = this.prismaStringFilterModeEnum();
            break;
          default:
            fieldType = type;
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

schemaBuilder.prismaStringFilterModeEnum = function prismaStringFilterModeEnum() {
  if (PrismaStringFilterModeRefMap.has(this)) {
    return PrismaStringFilterModeRefMap.get(this)!;
  }

  const ref = this.enumType('StringFilterMode', {
    values: {
      Default: { value: 'default' as const },
      Insensitive: { value: 'insensitive' as const },
    },
  });

  PrismaStringFilterModeRefMap.set(this, ref);

  return ref;
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
      const fields: InputFieldMap = {};

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

schemaBuilder.prismaScalarListFilter = function prismaScalarListFilter<
  Type extends InputType<SchemaTypes>,
  Ops extends OpsOptions<SchemaTypes, Type, ScalarListOps>,
>(type: Type, { name, ops, ...options }: PrismaScalarListFilterOptions<SchemaTypes, Type, Ops>) {
  let filterName = name;

  if (!filterName) {
    const typeName = nameFromType(type, this);

    filterName = `${typeName}ListFilter`;
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
      const fields: InputFieldMap = {};

      for (const op of Object.keys(opsOptions)) {
        let fieldType: InputTypeParam<SchemaTypes> = type;

        switch (op) {
          case 'has':
            fieldType = type;
            break;
          case 'equals':
          case 'hasSome':
          case 'hasEvery':
            fieldType = [type];
            break;
          case 'isEmpty':
            fieldType = 'Boolean' as typeof fieldType;
            break;
          default:
            throw new Error(`Invalid op ${op} for scalar list filter`);
        }

        fields[op] = t.field({
          required: false,
          type: fieldType,
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
      const fieldDefs: InputFieldMap = {};

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

  return ref as InputObjectRef<SchemaTypes, Model['OrderBy']>;
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
): InputObjectRef<SchemaTypes, Model['Where']> {
  const ref = this.inputRef<never>(name ?? `${nameFromType(type, this)}Filter`);
  const model = getModel(type, this);
  const nullableFields = new Set(
    model.fields.filter((field) => !field.isRequired).map((field) => field.name),
  );

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: {
        nullableFields,
      },
    },
    fields: (t) => {
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        if (field === 'AND' || field === 'OR' || field === 'NOT') {
          const fieldType =
            (fieldOption as unknown) === true ? ref : (fieldOption as InputRef<unknown>);
          fieldDefs[field] =
            fieldOption instanceof InputFieldRef
              ? (fieldOption as InputFieldRef<SchemaTypes, 'InputObject'>)
              : t.field({
                  required: false,
                  type: field === 'NOT' ? fieldType : [fieldType],
                  ...(typeof fieldOption === 'object' ? fieldOption : {}),
                });

          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? fieldOption
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
): InputObjectRef<SchemaTypes, Model['WhereUnique']> {
  const ref = this.inputRef<never>(name ?? `${nameFromType(type, this)}UniqueFilter`);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? fieldOption
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
  const ref = this.inputRef<never>(name ?? `${nameFromType(type, this)}CreateInput`);
  const model = getModel(type, this);

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldModel = model.fields.find(({ name: fieldName }) => fieldName === field)!;

        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? fieldOption
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
  const ref = this.inputRef<never>(name ?? `${nameFromType(type, this)}UpdateInput`);
  const model = getModel(type, this);

  const nullableFields = new Set(
    model.fields.filter((field) => !field.isRequired).map((field) => field.name),
  );

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: {
        nullableFields,
      },
    },
    fields: (t) => {
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldModel = model.fields.find(({ name: fieldName }) => fieldName === field)!;
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? fieldOption
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
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        fieldDefs[field] =
          fieldOption instanceof InputFieldRef
            ? fieldOption
            : t.field({
                required: false,
                type: fieldModel.isList
                  ? [fieldOption as InputRef<SchemaTypes>]
                  : (fieldOption as InputRef<SchemaTypes>),
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
      const fieldDefs: InputFieldMap = {};
      const fieldMap = typeof fields === 'function' ? fields(t) : fields;
      const model = getModel(type, this);
      const fieldModel = model.fields.find((field) => field.name === relation)!;

      Object.keys(fieldMap).forEach((field) => {
        const fieldOption = fieldMap[field as keyof typeof fieldMap]!;
        if (!fieldOption) {
          return;
        }

        if (fieldOption instanceof InputFieldRef) {
          fieldDefs[field] = fieldOption;
        } else if (fieldModel.isList && (field === 'update' || field === 'updateMany')) {
          const {
            name: nestedName = `${ref.name}U${field.slice(1)}`,
            where: whereType,
            data: dataType,
          } = fieldOption as {
            name?: string;
            where: InputFieldRef<SchemaTypes> | InputRef<unknown>;
            data: InputFieldRef<SchemaTypes> | InputRef<unknown>;
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
        } else if ((field === 'disconnect' || field === 'delete') && fieldOption === true) {
          fieldDefs[field] = t.field({
            required: false,
            type: 'Boolean',
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

schemaBuilder.prismaIntAtomicUpdate = function prismaIntUpdateOperations({
  name,
  ops = ['set', 'increment', 'decrement', 'multiply', 'divide'],
  ...options
} = {}) {
  const ref = this.inputRef<IntFieldUpdateOperationsInput>(name ?? 'IntAtomicUpdate');

  ref.implement({
    ...options,
    extensions: {
      ...options.extensions,
      pothosPrismaInput: true,
    },
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<SchemaTypes, unknown>> = {};

      ops.forEach((op) => {
        fieldDefs[op] = t.field({
          required: false,
          type: 'Int',
        });
      });

      return fieldDefs;
    },
  });

  return ref as never;
};

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
