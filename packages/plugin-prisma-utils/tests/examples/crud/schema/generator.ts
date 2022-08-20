import {
  BaseEnum,
  createContextCache,
  EnumRef,
  InputFieldRef,
  InputType,
  InputTypeRef,
  SchemaTypes,
} from '@pothos/core';
import { PrismaModelTypes } from '@pothos/plugin-prisma';
import { FilterOps } from '../../../../src/types';
// eslint-disable-next-line import/no-useless-path-segments
import { Prisma } from '../../../client/index';

const { datamodel } = Prisma.dmmf;

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;

function mapScalarType(type: string) {
  switch (type) {
    case 'String':
    case 'Int':
    case 'Float':
    case 'DateTime':
      return type;
    default:
      return null;
  }
}

const getCache = createContextCache(
  <Types extends SchemaTypes>(_: PothosSchemaTypes.SchemaBuilder<Types>) =>
    new Map<InputType<Types> | string, InputTypeRef<unknown> | EnumRef<unknown>>(),
);
const getListFilterCache = createContextCache(
  <Types extends SchemaTypes>(_: PothosSchemaTypes.SchemaBuilder<Types>) =>
    new Map<InputType<Types> | string, InputTypeRef<unknown> | EnumRef<unknown>>(),
);

function createFilter<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: InputType<Types>,
) {
  const cache = getCache(builder);

  if (cache.has(type)) {
    return cache.get(type)!;
  }

  const ops: FilterOps[] = [...filterOps];

  if (type === 'String') {
    ops.push(...stringFilterOps);
  }
  if (sortableTypes.includes(type as never)) {
    ops.push(...sortableFilterProps);
  }

  const filter = builder.prismaFilter(type, {
    ops,
  });

  cache.set(type, filter);

  return filter;
}

function createEnum<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  name: string,
) {
  const cache = getCache(builder);

  if (cache.has(name)) {
    return cache.get(name)!;
  }

  if (!(name in Prisma)) {
    throw new Error(`Enum ${name} not found`);
  }

  const enumRef = builder.enumType((Prisma as unknown as Record<string, BaseEnum>)[name], {
    name,
  });

  cache.set(name, enumRef);

  return enumRef;
}

function createListFilter<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  type: InputType<Types>,
) {
  const cache = getListFilterCache(builder);

  if (cache.has(type)) {
    return cache.get(type)!;
  }

  const filter = builder.prismaListFilter(type, {
    ops: listOps,
  });

  cache.set(type, filter);

  return filter;
}

export function filtersForTypes<Types extends SchemaTypes, Name extends keyof Types['PrismaTypes']>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typeNames: Name[],
) {
  const models = datamodel.models.filter((model) => typeNames.includes(model.name as Name));

  const refs: {
    [K in Name]?: InputTypeRef<(Types['PrismaTypes'][K] & PrismaModelTypes)['Where']>;
  } = {};

  for (const model of models) {
    refs[model.name as Name] = builder.prismaWhere(model.name as Name, {
      fields: (t) => {
        const fields: Record<string, InputType<Types>> = {};

        model.fields.forEach((field) => {
          let type;
          switch (field.kind) {
            case 'scalar':
              type = mapScalarType(field.type) as InputType<Types>;
              break;
            case 'enum':
              type = createEnum(builder, field.type);
              break;
            case 'object':
              type = refs[field.type as Name] ?? null;
              break;
            case 'unsupported':
              break;
            default:
              throw new Error(`Unknown field kind ${field.kind}`);
          }

          if (!type) {
            return;
          }

          const filter = field.kind === 'object' ? type : createFilter(builder, type);

          if (field.isList) {
            fields[field.name] = createListFilter(builder, filter);
          } else {
            fields[field.name] = filter;
          }
        });

        return fields as {};
      },
    });
  }

  return refs as Required<typeof refs>;
}

export function orderByForTypes<Types extends SchemaTypes, Name extends keyof Types['PrismaTypes']>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typeNames: Name[],
) {
  const models = datamodel.models.filter((model) => typeNames.includes(model.name as Name));

  const refs: {
    [K in Name]?: InputTypeRef<(Types['PrismaTypes'][K] & PrismaModelTypes)['OrderBy']>;
  } = {};

  for (const model of models) {
    refs[model.name as Name] = builder.prismaOrderBy(model.name as Name, {
      fields: () => {
        const fields: Record<string, InputType<Types> | boolean> = {};

        model.fields.forEach((field) => {
          let type;
          switch (field.kind) {
            case 'scalar':
            case 'enum':
              type = true;
              break;
            case 'object':
              type = refs[field.type as Name] ?? null;
              break;
            case 'unsupported':
              break;
            default:
              throw new Error(`Unknown field kind ${field.kind}`);
          }

          if (type) {
            fields[field.name] = type;
          }
        });

        return fields as {};
      },
    });
  }

  return refs as Required<typeof refs>;
}

export function argsForTypes<Types extends SchemaTypes, Name extends keyof Types['PrismaTypes']>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  typeNames: Name[],
) {
  const orderBys = orderByForTypes(builder, typeNames);
  const filters = filtersForTypes(builder, typeNames);

  const args: {
    [K in Name]?: {
      filter?: InputFieldRef<
        (Types['PrismaTypes'][K] & PrismaModelTypes)['Where'] | undefined,
        'Arg'
      >;
      orderBy?: InputFieldRef<
        (Types['PrismaTypes'][K] & PrismaModelTypes)['OrderBy'] | undefined,
        'Arg'
      >;
    };
  } = {};

  for (const type of Object.keys(orderBys) as Name[]) {
    const orderBy = orderBys[type];
    const filter = filters[type];

    if (orderBy && filter) {
      args[type] = builder.args((t) => ({
        filter: t.field({ type: filter!, required: false }),
        orderBy: t.field({ type: orderBy!, required: false }),
      })) as typeof args[Name];
    }
  }

  return args as Required<typeof args>;
}
