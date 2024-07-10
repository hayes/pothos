import {
  BaseEnum,
  EnumRef,
  InputObjectRef,
  InputType,
  InputTypeParam,
  SchemaTypes,
} from '@pothos/core';
import { getModel, PrismaModelTypes } from '@pothos/plugin-prisma';
import { FilterOps } from '../../../src';
import * as Prisma from '../../client';

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;
const scalarListOps = ['has', 'hasSome', 'hasEvery', 'isEmpty', 'equals'] as const;

export class PrismaCrudGenerator<Types extends SchemaTypes> {
  private builder;

  private refCache = new Map<
    InputType<Types> | string,
    Map<string, InputObjectRef<Types, unknown>>
  >();

  private enumRefs = new Map<string, EnumRef<Types, unknown>>();

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    this.builder = builder;
  }

  findManyArgs<Name extends string & keyof Types['PrismaTypes']>(modelName: Name) {
    return this.builder.args((t) => ({
      filter: t.field({
        type: this.getWhere(modelName),
        required: false,
      }),
      orderBy: t.field({
        type: this.getOrderBy(modelName),
        required: false,
      }),
    }));
  }

  getWhere<Name extends string & keyof Types['PrismaTypes']>(modelName: Name, without?: string[]) {
    const withoutName = (without ?? []).map((name) => `Without${capitalize(name)}`).join('');
    const fullName = `${modelName}${withoutName}Filter`;

    return this.getRef(modelName, fullName, () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaWhere(modelName, {
        name: fullName,
        fields: (() => {
          const fields: Record<string, InputType<Types>> = {};
          const withoutFields = model.fields.filter((field) => without?.includes(field.name));

          model.fields
            .filter(
              (field) =>
                !withoutFields.some(
                  (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
                ),
            )
            .forEach((field) => {
              let type;
              switch (field.kind) {
                case 'scalar':
                  type = field.isList
                    ? this.getScalarListFilter(this.mapScalarType(field.type) as InputType<Types>)
                    : this.getFilter(this.mapScalarType(field.type) as InputType<Types>);
                  break;
                case 'enum':
                  type = field.isList
                    ? this.getScalarListFilter(this.getEnum(field.type))
                    : this.getFilter(this.getEnum(field.type));
                  break;
                case 'object':
                  type = field.isList
                    ? this.getListFilter(this.getWhere(field.type as Name))
                    : this.getWhere(field.type as Name);
                  break;
                case 'unsupported':
                  break;
                default:
                  throw new Error(`Unknown field kind ${field.kind}`);
              }

              if (!type) {
                return;
              }

              fields[field.name] = type;
            });

          return fields;
        }) as never,
      }) as InputObjectRef<Types, (PrismaModelTypes & Types['PrismaTypes'][Name])['Where']>;
    });
  }

  getWhereUnique<Name extends string & keyof Types['PrismaTypes']>(modelName: Name) {
    const name = `${modelName}UniqueFilter`;

    return this.getRef(modelName, name, () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaWhereUnique(modelName, {
        name,
        fields: (() => {
          const fields: Record<string, InputType<Types>> = {};

          model.fields
            .filter(
              (field) =>
                field.isUnique ||
                field.isId ||
                model.uniqueIndexes.some((index) => index.fields.includes(field.name)) ||
                model.primaryKey?.fields.includes(field.name),
            )
            .forEach((field) => {
              let type;
              switch (field.kind) {
                case 'scalar':
                  type = this.mapScalarType(field.type) as InputType<Types>;
                  break;
                case 'enum':
                  type = this.getEnum(field.type);
                  break;
                case 'object':
                case 'unsupported':
                  break;
                default:
                  throw new Error(`Unknown field kind ${field.kind}`);
              }

              if (!type) {
                return;
              }

              fields[field.name] = type;
            });

          return fields;
        }) as never,
      }) as InputObjectRef<Types, (PrismaModelTypes & Types['PrismaTypes'][Name])['WhereUnique']>;
    });
  }

  getOrderBy<Name extends string & keyof Types['PrismaTypes']>(modelName: Name) {
    const name = `${modelName}OrderBy`;
    return this.getRef(modelName, name, () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaOrderBy(modelName, {
        name,
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
                type = this.getOrderBy(field.type as Name);
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
    });
  }

  getCreateInput<Name extends string & keyof Types['PrismaTypes']>(
    modelName: Name,
    without?: string[],
  ) {
    const withoutName = (without ?? []).map((name) => `Without${capitalize(name)}`).join('');
    const fullName = `${modelName}Create${withoutName}Input`;

    return this.getRef(modelName, fullName, () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaCreate(modelName, {
        name: fullName,
        fields: (() => {
          const fields: Record<string, InputTypeParam<Types>> = {};
          const withoutFields = model.fields.filter((field) => without?.includes(field.name));
          const relationIds = model.fields.flatMap((field) => field.relationFromFields ?? []);

          model.fields
            .filter(
              (field) =>
                !withoutFields.some(
                  (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
                ) && !relationIds.includes(field.name),
            )
            .forEach((field) => {
              let type;
              switch (field.kind) {
                case 'scalar':
                  type = this.mapScalarType(field.type) as InputType<Types>;
                  break;
                case 'enum':
                  type = this.getEnum(field.type);
                  break;
                case 'object':
                  type = this.getCreateRelationInput(modelName, field.name);
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

          return fields;
        }) as never,
      }) as InputObjectRef<Types, (PrismaModelTypes & Types['PrismaTypes'][Name])['Create']>;
    });
  }

  getCreateRelationInput<
    Name extends string & keyof Types['PrismaTypes'],
    Relation extends Model['RelationName'],
    Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
      ? Types['PrismaTypes'][Name]
      : never,
  >(modelName: Name, relation: Relation) {
    return this.getRef(`${modelName}${capitalize(relation)}`, 'CreateRelationInput', () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaCreateRelation(modelName, relation, {
        fields: () => {
          const relationField = model.fields.find((field) => field.name === relation)!;
          const relatedModel = getModel(relationField.type, this.builder);
          const relatedFieldName = relatedModel.fields.find(
            (field) => field.relationName === relationField.relationName,
          )!;

          return {
            create: this.getCreateInput(relationField.type as Name, [relatedFieldName.name]),
            connect: this.getWhereUnique(relationField.type as Name),
          };
        },
      } as never) as InputObjectRef<
        Types,
        NonNullable<Model['Create'][Relation & keyof Model['Update']]>
      >;
    });
  }

  getUpdateInput<Name extends string & keyof Types['PrismaTypes']>(
    modelName: Name,
    without?: string[],
  ) {
    const withoutName = (without ?? []).map((name) => `Without${capitalize(name)}`).join('');
    const fullName = `${modelName}Update${withoutName}Input`;

    return this.getRef(modelName, fullName, () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaUpdate(modelName, {
        name: fullName,
        fields: (() => {
          const fields: Record<string, InputTypeParam<Types>> = {};
          const withoutFields = model.fields.filter((field) => without?.includes(field.name));
          const relationIds = model.fields.flatMap((field) => field.relationFromFields ?? []);

          model.fields
            .filter(
              (field) =>
                !withoutFields.some(
                  (f) => f.name === field.name || f.relationFromFields?.includes(field.name),
                ) && !relationIds.includes(field.name),
            )
            .forEach((field) => {
              let type;
              switch (field.kind) {
                case 'scalar':
                  type = this.mapScalarType(field.type) as InputType<Types>;
                  break;
                case 'enum':
                  type = this.getEnum(field.type);
                  break;
                case 'object':
                  type = this.getUpdateRelationInput(modelName, field.name);
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

          return fields;
        }) as never,
      }) as InputObjectRef<Types, (PrismaModelTypes & Types['PrismaTypes'][Name])['Update']>;
    });
  }

  getUpdateRelationInput<
    Name extends string & keyof Types['PrismaTypes'],
    Relation extends Model['RelationName'],
    Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
      ? Types['PrismaTypes'][Name]
      : never,
  >(modelName: Name, relation: Relation) {
    return this.getRef(`${modelName}${capitalize(relation)}`, 'UpdateRelationInput', () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaUpdateRelation(modelName, relation, {
        fields: () => {
          const relationField = model.fields.find((field) => field.name === relation)!;
          const relatedModel = getModel(relationField.type, this.builder);
          const relatedFieldName = relatedModel.fields.find(
            (field) => field.relationName === relationField.relationName,
          )!.name;

          if (relationField.isList) {
            return {
              create: this.getCreateInput(relationField.type as Name, [relatedFieldName]),
              set: this.getWhereUnique(relationField.type as Name),
              disconnect: this.getWhereUnique(relationField.type as Name),
              delete: this.getWhereUnique(relationField.type as Name),
              connect: this.getWhereUnique(relationField.type as Name),
              update: {
                where: this.getWhereUnique(relationField.type as Name),
                data: this.getUpdateInput(relationField.type as Name, [relatedFieldName]),
              },
              updateMany: {
                where: this.getWhere(relationField.type as Name, [relatedFieldName]),
                data: this.getUpdateInput(relationField.type as Name, [relatedFieldName]),
              },
              deleteMany: this.getWhere(relationField.type as Name, [relatedFieldName]),
            };
          }

          return {
            create: this.getCreateInput(relationField.type as Name, [relatedFieldName]),
            update: this.getUpdateInput(relationField.type as Name, [relatedFieldName]),
            connect: this.getWhereUnique(relationField.type as Name),
            disconnect: relationField.isRequired ? undefined : 'Boolean',
            delete: relationField.isRequired ? undefined : 'Boolean',
          };
        },
      } as never) as InputObjectRef<
        Types,
        NonNullable<Model['Update'][Relation & keyof Model['Update']]>
      >;
    });
  }

  private getFilter(type: InputType<Types>) {
    return this.getRef(type, `${String(type)}Filter`, () => {
      const ops: FilterOps[] = [...filterOps];

      if (type === 'String') {
        ops.push(...stringFilterOps);
      }
      if (sortableTypes.includes(type as never)) {
        ops.push(...sortableFilterProps);
      }

      return this.builder.prismaFilter(type, {
        ops,
      });
    });
  }

  private getScalarListFilter(type: InputType<Types>) {
    return this.getRef(type, `${String(type)}ListFilter`, () =>
      this.builder.prismaScalarListFilter(type, {
        ops: scalarListOps,
      }),
    );
  }

  private getListFilter(type: InputType<Types>) {
    return this.getRef(type, `${String(type)}ListFilter`, () =>
      this.builder.prismaListFilter(type, {
        ops: listOps,
      }),
    );
  }

  private getEnum(name: string) {
    if (!this.enumRefs.has(name)) {
      const enumRef = this.builder.enumType((Prisma as unknown as Record<string, BaseEnum>)[name], {
        name,
      });

      this.enumRefs.set(name, enumRef);
    }

    return this.enumRefs.get(name)!;
  }

  private mapScalarType(type: string) {
    switch (type) {
      case 'String':
      case 'Boolean':
      case 'Int':
      case 'Float':
      case 'DateTime':
        return type;
      default:
        return null;
    }
  }

  private getRef<T extends InputObjectRef<Types, unknown>>(
    key: InputType<Types> | string,
    name: string,
    create: () => T,
  ): T {
    if (!this.refCache.has(key)) {
      this.refCache.set(key, new Map());
    }
    const cache = this.refCache.get(key)!;

    if (cache.has(name)) {
      return cache.get(name)! as T;
    }

    const ref = new InputObjectRef<Types, unknown>(name);

    cache.set(name, ref);

    this.builder.configStore.associateParamWithRef(ref, create());

    return ref as T;
  }
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
