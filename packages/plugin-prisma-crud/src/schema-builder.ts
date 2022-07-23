import SchemaBuilder, {
  BaseTypeRef,
  EnumRef,
  InputFieldRef,
  InputRef,
  InputShapeFromTypeParam,
  InputType,
  SchemaTypes,
} from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';
import {
  FilterListOps,
  FilterOps,
  FilterShape,
  PrismaFilterOptions,
  PrismaListFilterOptions,
  PrismaOrderByOptions,
} from './types';

export const schemaBuilder =
  SchemaBuilder.prototype as PothosSchemaTypes.SchemaBuilder<SchemaTypes>;

const OrderByRefMap = new WeakMap<
  PothosSchemaTypes.SchemaBuilder<SchemaTypes>,
  EnumRef<'asc' | 'desc'>
>();

schemaBuilder.prismaFilter = function prismaFilter<
  Type extends InputType<SchemaTypes>,
  Ops extends FilterOps,
>(type: Type, { ops, name, ...options }: PrismaFilterOptions<SchemaTypes, Type, Ops>) {
  const filterName = name ?? `${nameFromType(type, this)}Filter`;
  const ref =
    this.inputRef<Pick<FilterShape<InputShapeFromTypeParam<SchemaTypes, Type, true>>, Ops>>(
      filterName,
    );

  ref.implement({
    ...options,
    fields: (t) => {
      const fields: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      for (const op of ops) {
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
        });
      }

      return fields as never;
    },
  });

  return ref as InputRef<Pick<FilterShape<InputShapeFromTypeParam<SchemaTypes, Type, true>>, Ops>>;
};

schemaBuilder.prismaListFilter = function prismaListFilter<
  Type extends InputType<SchemaTypes>,
  Ops extends FilterListOps,
>(type: Type, { name, ops, ...options }: PrismaListFilterOptions<SchemaTypes, Type, Ops>) {
  let filterName = name;

  if (!filterName) {
    const typeName = nameFromType(type, this);

    filterName = typeName.endsWith('Filter')
      ? typeName.replace(/Filter$/, 'ListFilter')
      : `List${typeName}`;
  }

  const ref = this.inputRef<{
    [K in Ops]: InputShapeFromTypeParam<SchemaTypes, Type, true>;
  }>(filterName);

  ref.implement({
    ...options,
    fields: (t) => {
      const fields: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      for (const op of ops) {
        fields[op] = t.field({
          required: false,
          type,
        });
      }

      return fields as never;
    },
  });

  return ref as InputRef<{
    [K in Ops]: InputShapeFromTypeParam<SchemaTypes, Type, true>;
  }>;
};

schemaBuilder.orderByEnum = function orderByEnum() {
  if (OrderByRefMap.has(this)) {
    return OrderByRefMap.get(this)!;
  }

  const ref = this.enumType('OrderBy', {
    values: ['asc', 'desc'] as const,
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
    fields: (t) => {
      const fieldDefs: Record<string, InputFieldRef<unknown, 'InputObject'>> = {};

      Object.keys(fields).forEach((field) => {
        const fieldOption = fields[field as keyof typeof fields];
        if (typeof fieldOption === 'boolean') {
          fieldDefs[field] = t.field({
            required: false,
            type: this.orderByEnum(),
          });
        } else {
          fieldDefs[field] = t.field({
            required: false,
            type: (typeof fieldOption === 'function'
              ? fieldOption()
              : fieldOption) as InputRef<unknown>,
          });
        }
      });

      return fieldDefs as never;
    },
  });

  return ref as InputRef<Model['OrderBy']>;
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

  throw new Error(`Unable to determine name for type ${String(type)}`);
}
