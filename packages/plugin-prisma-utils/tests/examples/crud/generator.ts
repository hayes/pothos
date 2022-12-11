import { BaseEnum, EnumRef, InputObjectRef, InputType, SchemaTypes } from '@pothos/core';
import { getModel, PrismaModelTypes } from '@pothos/plugin-prisma';
import { FilterOps } from '../../../src';
import { Prisma } from '../../client';

const filterOps = ['equals', 'in', 'notIn', 'not', 'is', 'isNot'] as const;
const sortableFilterProps = ['lt', 'lte', 'gt', 'gte'] as const;
const stringFilterOps = [...filterOps, 'contains', 'startsWith', 'endsWith'] as const;
const sortableTypes = ['String', 'Int', 'Float', 'DateTime', 'BigInt'] as const;
const listOps = ['every', 'some', 'none'] as const;

export class PrismaCrudGenerator<Types extends SchemaTypes> {
  private builder;

  private refCache = new Map<string, Map<string | InputType<Types>, InputObjectRef<unknown>>>();

  private enumRefs = new Map<string, EnumRef<unknown>>();

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>) {
    this.builder = builder;
  }

  findManyArgs<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
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

  getWhere<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
    return this.getRef(modelName, 'Filter', () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaWhere(modelName, {
        fields: (t) => {
          const fields: Record<string, InputType<Types>> = {};

          model.fields.forEach((field) => {
            let type;
            switch (field.kind) {
              case 'scalar':
                type = this.mapScalarType(field.type) as InputType<Types>;
                break;
              case 'enum':
                type = this.getEnum(field.type);
                break;
              case 'object':
                type = this.getWhere(field.type as Name);
                break;
              case 'unsupported':
                break;
              default:
                throw new Error(`Unknown field kind ${field.kind}`);
            }

            if (!type) {
              return;
            }

            const filter = field.kind === 'object' ? type : this.getFilter(type);

            if (field.isList) {
              fields[field.name] = this.getListFilter(filter);
            } else {
              fields[field.name] = filter;
            }
          });

          return fields as {};
        },
      }) as InputObjectRef<(Types['PrismaTypes'][Name] & PrismaModelTypes)['Where']>;
    });
  }

  getWhereUnique<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
    return this.getRef(modelName, 'UniqueFilter', () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaWhereUnique(modelName, {
        fields: (t) => {
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
                  type = this.getWhere(field.type as Name);
                  break;
                case 'unsupported':
                  break;
                default:
                  throw new Error(`Unknown field kind ${field.kind}`);
              }

              if (!type) {
                return;
              }

              const filter = field.kind === 'object' ? type : this.getFilter(type);

              if (field.isList) {
                fields[field.name] = this.getListFilter(filter);
              } else {
                fields[field.name] = filter;
              }
            });

          return fields as {};
        },
      }) as InputObjectRef<(Types['PrismaTypes'][Name] & PrismaModelTypes)['WhereUnique']>;
    });
  }

  getOrderBy<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
    return this.getRef(modelName, 'OrderBy', () => {
      const model = getModel(modelName, this.builder);

      return this.builder.prismaOrderBy(modelName, {
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

  getCreateInput<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
    return this.getRef(modelName, 'CreateInput', () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaCreate(modelName, {
        fields: (t) => {
          const fields: Record<string, InputType<Types>> = {};

          model.fields.forEach((field) => {
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

          return fields as {};
        },
      }) as InputObjectRef<(Types['PrismaTypes'][Name] & PrismaModelTypes)['Create']>;
    });
  }

  getCreateRelationInput<
    Name extends keyof Types['PrismaTypes'] & string,
    Relation extends Model['RelationName'],
    Model extends PrismaModelTypes = Types['PrismaTypes'][Name] extends PrismaModelTypes
      ? Types['PrismaTypes'][Name]
      : never,
  >(modelName: Name, relation: Relation) {
    return this.getRef(`${modelName}${capitalize(relation)}`, 'CreateRelationInput', () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaCreateRelation(modelName, relation, {
        fields: () => {
          const relationModel = model.fields.find((field) => field.name === relation)!.type;
          return {
            create: this.getCreateInput(relationModel as Name),
            connect: this.getWhereUnique(relationModel as Name),
          };
        },
      } as never) as InputObjectRef<NonNullable<Model['Create'][Relation & keyof Model['Update']]>>;
    });
  }

  getUpdateInput<Name extends keyof Types['PrismaTypes'] & string>(modelName: Name) {
    return this.getRef(modelName, 'UpdateInput', () => {
      const model = getModel(modelName, this.builder);
      return this.builder.prismaUpdate(modelName, {
        fields: (t) => {
          const fields: Record<string, InputType<Types>> = {};

          model.fields.forEach((field) => {
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

          return fields as {};
        },
      }) as InputObjectRef<(Types['PrismaTypes'][Name] & PrismaModelTypes)['Update']>;
    });
  }

  getUpdateRelationInput<
    Name extends keyof Types['PrismaTypes'] & string,
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

          if (relationField.isList) {
            return {
              create: this.getCreateInput(relationField.type as Name),
              set: this.getWhereUnique(relationField.type as Name),
              disconnect: this.getWhereUnique(relationField.type as Name),
              delete: this.getWhereUnique(relationField.type as Name),
              connect: this.getWhereUnique(relationField.type as Name),
              update: this.getUpdateInput(relationField.type as Name),
              updateMany: this.getWhere(relationField.type as Name),
              deleteMany: this.getWhere(relationField.type as Name),
            };
          }

          return {
            create: this.getCreateInput(relationField.type as Name),
            update: this.getUpdateInput(relationField.type as Name),
            connect: this.getWhereUnique(relationField.type as Name),
            disconnect: 'Boolean',
            delete: 'Boolean',
          };
        },
      } as never) as InputObjectRef<NonNullable<Model['Update'][Relation & keyof Model['Update']]>>;
    });
  }

  private getFilter(type: InputType<Types>) {
    return this.getRef(type, 'Filter', () => {
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

  private getListFilter(type: InputType<Types>) {
    return this.getRef(type, 'ListFilter', () =>
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
      case 'Int':
      case 'Float':
      case 'DateTime':
        return type;
      default:
        return null;
    }
  }

  private getRef<T extends InputObjectRef<unknown>>(
    key: string | InputType<Types>,
    kind: string,
    create: () => T,
  ): T {
    if (!this.refCache.has(kind)) {
      this.refCache.set(kind, new Map());
    }
    const cache = this.refCache.get(kind)!;

    if (cache.has(key)) {
      return cache.get(key)! as T;
    }

    const ref = new InputObjectRef(`${String(key)}${kind}`);

    cache.set(key, ref);

    this.builder.configStore.associateRefWithName(ref, create().name);

    return ref as T;
  }
}

function capitalize(str: string) {
  return str[0].toUpperCase() + str.slice(1);
}
