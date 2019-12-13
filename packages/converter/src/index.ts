import {
  Project,
  SourceFile,
  StructureKind,
  VariableDeclarationKind,
  CodeBlockWriter,
} from 'ts-morph';
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLScalarType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLNamedType,
  GraphQLField,
  GraphQLNonNull,
  GraphQLType,
  GraphQLList,
  GraphQLInputField,
  GraphQLEnumValue,
} from 'graphql';

const builtins = ['Boolean', 'Int', 'Float', 'String', 'ID'];

function unwrap(type: GraphQLType): GraphQLNamedType {
  if (type instanceof GraphQLNonNull) {
    return unwrap(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return unwrap(type.ofType);
  }

  return type;
}

function isRecursive(type: GraphQLNamedType, seen: string[] = []): boolean {
  if (
    !(
      type instanceof GraphQLObjectType ||
      type instanceof GraphQLInputObjectType ||
      type instanceof GraphQLInterfaceType
    )
  ) {
    return false;
  }

  const fieldMap = type.getFields();
  const fields = Object.keys(fieldMap).map(name => fieldMap[name]);

  return !!fields.find(field => {
    const fieldType = unwrap(field.type);

    if (fieldType.name === type.name) {
      return true;
    }

    if (seen.includes(fieldType.name)) {
      return true;
    }

    return isRecursive(fieldType, [...seen, type.name]);
  });
}

export default class GirphQLConverter {
  project = new Project();

  schema: GraphQLSchema;

  sourcefile: SourceFile;

  types: string[] | null;

  constructor(schema: GraphQLSchema, { types }: { types?: string[] | null } = {}) {
    this.schema = schema;
    this.sourcefile = this.project.createSourceFile('./codegen/schema.ts');

    this.types = types || null;

    this.createSchemaTypes();
  }

  createSchemaTypes() {
    const typeMap = this.schema.getTypeMap();

    const gqlTypes = Object.keys(typeMap).map(typeName => typeMap[typeName]);

    if (!this.types) {
      this.sourcefile.addImportDeclaration({
        kind: StructureKind.ImportDeclaration,
        moduleSpecifier: '@giraphql/core',
        defaultImport: 'SchemaBuilder',
      });

      this.sourcefile.addStatements(writer => writer.blankLine());

      this.sourcefile.addVariableStatement({
        kind: StructureKind.VariableStatement,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            kind: StructureKind.VariableDeclaration,
            name: 'builder',
            initializer: writer => {
              writer.writeLine('new SchemaBuilder<{');
              writer.indent(() => {
                this.writeTypeInfo(writer);
              });
              writer.writeLine('}>()');
            },
          },
        ],
      });
    }

    gqlTypes.forEach(type => {
      if (type.name.slice(0, 2) === '__' || builtins.includes(type.name)) {
        return;
      }

      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type instanceof GraphQLUnionType) {
        this.createUnionType(type);
      } else if (type instanceof GraphQLEnumType) {
        this.createEnumType(type);
      } else if (type instanceof GraphQLScalarType) {
        this.createScalarType(type);
      }
    });

    gqlTypes.forEach(type => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type instanceof GraphQLInputObjectType) {
        this.createInputType(type);
      }
    });

    gqlTypes.forEach(type => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }
      if (this.types && !this.types.includes(type.name)) {
        return;
      }
      if (type instanceof GraphQLInterfaceType) {
        this.createInterfaceType(type);
      }
    });

    gqlTypes.forEach(type => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type.name.slice(0, 2) === '__') {
        return;
      }

      if (type instanceof GraphQLObjectType) {
        if (type.name === 'Query') {
          this.createQueryType(type);
        } else if (type.name === 'Mutation') {
          this.createMutationType(type);
        } else if (type.name === 'Subscription') {
          this.createSubscriptionType(type);
        } else {
          this.createObjectType(type);
        }
      }
    });

    if (!this.types) {
      this.sourcefile.addVariableStatement({
        kind: StructureKind.VariableStatement,
        declarationKind: VariableDeclarationKind.Const,
        isExported: true,
        declarations: [
          {
            kind: StructureKind.VariableDeclaration,
            name: 'schema',
            initializer: writer => {
              writer.writeLine('builder.toSchema([');
              writer.indent(() => {
                gqlTypes.forEach(type => {
                  if (type.name.slice(0, 2) === '__' || builtins.includes(type.name)) {
                    return;
                  }

                  writer.writeLine(`${type.name},`);
                });
              });
              writer.writeLine('])');
            },
          },
        ],
      });
    }
  }

  createQueryType(type: GraphQLObjectType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: 'Query',
          initializer: writer => {
            writer.writeLine('builder.createQueryType({');
            writer.indent(() => {
              this.writeDescription(writer, type);
              this.writeObjectShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createMutationType(type: GraphQLObjectType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: 'Mutation',
          initializer: writer => {
            writer.writeLine('builder.createMutationType({');
            writer.indent(() => {
              this.writeDescription(writer, type);
              this.writeObjectShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createSubscriptionType(type: GraphQLObjectType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: 'Subscription',
          initializer: writer => {
            writer.writeLine('builder.createSubscriptionType({');
            writer.indent(() => {
              this.writeDescription(writer, type);
              this.writeObjectShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createObjectType(type: GraphQLObjectType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createObjectType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              if (type.getInterfaces().length !== 0) {
                writer.writeLine(
                  `implements: [${type
                    .getInterfaces()
                    .map(i => i.name)
                    .join(', ')}],`,
                );
              }
              writer.writeLine(
                `isType: (obj, context, info) => { throw new Error('Not implemented') },`,
              );
              this.writeObjectShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createInterfaceType(type: GraphQLInterfaceType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createInterfaceType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              this.writeObjectShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createUnionType(type: GraphQLUnionType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createUnionType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              writer.writeLine(`members: [${type.getTypes().map(t => `'${t.name}'`)}],`);
              writer.writeLine(
                `resolveType: (parent, context, info) => throw new Error('Not implemented')`,
              );
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createScalarType(type: GraphQLScalarType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createScalarType('${type.name}', new GraphQLScalarType({`);
            writer.indent(() => {
              writer.writeLine(`name: '${type.name}',`);
              writer.writeLine(`serialize: () => { throw new Error('Not implemented') },`);
            });
            writer.writeLine('}))');
          },
        },
      ],
    });
  }

  createInputType(type: GraphQLInputObjectType) {
    if (isRecursive(type)) {
      this.createInputShape(type);
    }

    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createInputType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              this.writeInputShape(writer, type);
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  createInputShape(type: GraphQLInputObjectType) {
    const fieldMap = type.getFields();
    const fields = Object.keys(fieldMap).map(name => fieldMap[name]);

    this.sourcefile.addInterface({
      kind: StructureKind.Interface,
      name: `${type.name}Shape`,
      properties: fields.map(field => ({
        name: field.name,
        type: writer => this.writeInputFieldShape(writer, field.type, type),
      })),
    });
  }

  createEnumType(type: GraphQLEnumType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: writer => {
            writer.writeLine(`builder.createEnumType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              writer.writeLine('values: {');
              writer.indent(() => {
                type.getValues().forEach(value => {
                  writer.writeLine(`${value.name}: {`);
                  writer.indent(() => {
                    this.writeDescription(writer, value);
                    writer.write(`value: `);
                    if (value.value) {
                      writer.write(
                        typeof value.value === 'number' ? `${value.value},` : `'${value.value}',`,
                      );
                    } else {
                      writer.write(value.name);
                    }
                    writer.newLine();
                  });
                  writer.writeLine('},');
                });
              });
              writer.writeLine('},');
            });
            writer.writeLine('})');
          },
        },
      ],
    });
  }

  writeObjectShape(writer: CodeBlockWriter, type: GraphQLObjectType | GraphQLInterfaceType) {
    const fieldMap = type.getFields();
    const inheritedFields =
      type instanceof GraphQLObjectType
        ? type
            .getInterfaces()
            .map(i => Object.keys(i.getFields()))
            .reduce((all, fields) => [...all, ...fields], [] as string[])
        : [];
    const fields = Object.keys(fieldMap).map(f => fieldMap[f]);
    writer.writeLine('shape: t => ({');
    writer.indent(() => {
      fields.forEach(field => {
        if (inheritedFields.includes(field.name)) {
          return;
        }

        writer.writeLine(`${field.name}: t.field({`);
        writer.indent(() => {
          this.writeDescription(writer, field);
          this.writeArgs(writer, field);
          writer.write('type: ');
          this.writeType(writer, field.type);
          writer.writeLine(',');
          writer.write('nullable: ');
          this.writeNullability(writer, field.type);
          writer.writeLine(',');
          writer.writeLine(
            `resolve: (parent, args, context, info) => { throw new Error('Not implemented') },`,
          );

          if (type.name === 'Subscription') {
            writer.writeLine(
              `subscribe: (parent, args, context, info) => { throw new Error('Not implemented') },`,
            );
          }
        });
        writer.writeLine('})');
      });
    });
    writer.writeLine('}),');
  }

  writeInputShape(writer: CodeBlockWriter, type: GraphQLInputObjectType) {
    writer.writeLine('shape: t => ({');
    writer.indent(() => {
      const fieldMap = type.getFields();
      const fields = Object.keys(fieldMap).map(name => fieldMap[name]);

      fields.forEach(field => {
        writer.write(`${field.name}: t.type(`);
        this.writeType(writer, field.type);
        writer.write(', {');
        writer.newLine();
        writer.indent(() => {
          this.writeDescription(writer, field);
          writer.write('required: ');
          this.writeRequiredness(writer, field.type);
          writer.write(',');
          writer.newLine();
        });
        writer.writeLine('}),');
      });
    });
    writer.writeLine('}),');
  }

  writeDescription(
    writer: CodeBlockWriter,
    type: GraphQLNamedType | GraphQLField<unknown, unknown> | GraphQLInputField | GraphQLEnumValue,
  ) {
    if (type.description) {
      writer.write('description:');
      writer.quote(type.description);
      writer.writeLine(',');
    }
  }

  writeType(writer: CodeBlockWriter, type: GraphQLType): void {
    if (type instanceof GraphQLNonNull) {
      this.writeType(writer, type.ofType);
      return;
    }

    if (type instanceof GraphQLList) {
      writer.write('[');
      this.writeType(writer, type.ofType);
      writer.write(']');
      return;
    }

    if (
      type instanceof GraphQLScalarType ||
      type instanceof GraphQLObjectType ||
      type instanceof GraphQLInterfaceType ||
      isRecursive(type)
    ) {
      writer.write(`'${type.name}'`);
      return;
    }

    writer.write(type.name);
  }

  writeInputFieldShape(
    writer: CodeBlockWriter,
    wrappedType: GraphQLType,
    rootType: GraphQLInputObjectType,
  ): void {
    const type = unwrap(wrappedType);

    if (wrappedType instanceof GraphQLNonNull && wrappedType.ofType instanceof GraphQLList) {
      this.writeInputFieldShape(writer, wrappedType.ofType.ofType, rootType);
      writer.write('[]');
    } else if (wrappedType instanceof GraphQLList) {
      this.writeInputFieldShape(writer, wrappedType.ofType, rootType);
      writer.write('[]');
    } else if (type instanceof GraphQLScalarType) {
      switch (type.name) {
        case 'String':
          writer.write('string');
          break;
        case 'Int':
          writer.write('number');
          break;
        case 'Float':
          writer.write('number');
          break;
        case 'ID':
          writer.write('string');
          break;
        case 'Boolean':
          writer.write('boolean');
          break;
        default:
          writer.write('unknown');
      }
    } else if (type.name === rootType.name) {
      writer.write(`${rootType.name}Shape`);
    } else if (type instanceof GraphQLInputObjectType) {
      if (isRecursive(type)) {
        writer.write(`${rootType.name}Shape`);
        throw type;
      } else {
        writer.write('{');
        writer.newLine();
        writer.indent(() => {
          const fieldMap = type.getFields();
          const fields = Object.keys(fieldMap).map(name => fieldMap[name]);

          fields.forEach(field => {
            writer.write(`${field.name}: `);
            this.writeInputFieldShape(writer, field.type, rootType);
            writer.write(';');
            writer.newLine();
          });
        });
        writer.newLine();
        writer.write('}');
      }
    } else {
      writer.write(rootType.name);
    }

    if (!(wrappedType instanceof GraphQLNonNull)) {
      writer.write('| null | undefined');
    }
  }

  writeNullability(writer: CodeBlockWriter, type: GraphQLType) {
    if (type instanceof GraphQLNonNull) {
      if (type.ofType instanceof GraphQLList) {
        if (type.ofType.ofType instanceof GraphQLNonNull) {
          writer.write(`{ list: false, items: false }`);
        } else {
          writer.write(`{ list: false, items: true }`);
        }
      } else {
        writer.write('false');
      }
    } else if (type instanceof GraphQLList) {
      if (type.ofType instanceof GraphQLNonNull) {
        writer.write(`{ list: true, items: false }`);
      } else {
        writer.write(`{ list: true, items: true }`);
      }
    } else {
      writer.write('true');
    }
  }

  writeRequiredness(writer: CodeBlockWriter, type: GraphQLType) {
    if (type instanceof GraphQLNonNull) {
      if (type.ofType instanceof GraphQLList) {
        if (type.ofType.ofType instanceof GraphQLNonNull) {
          writer.write(`{ list: true, items: true }`);
        } else {
          writer.write(`{ list: true, items: false }`);
        }
      } else {
        writer.write('true');
      }
    } else if (type instanceof GraphQLList) {
      if (type.ofType instanceof GraphQLNonNull) {
        writer.write(`{ list: false, items: true }`);
      } else {
        writer.write(`{ list: false, items: false }`);
      }
    } else {
      writer.write('false');
    }
  }

  writeArgs(writer: CodeBlockWriter, type: GraphQLField<unknown, unknown>) {
    if (type.args.length !== 0) {
      writer.write('args: {');
      writer.indent(() => {
        type.args.forEach(arg => {
          writer.write(`${arg.name}: t.arg.type(`);
          this.writeType(writer, arg.type);
          writer.write(', {');
          writer.newLine();
          writer.indent(() => {
            this.writeDescription(writer, arg);
            writer.write('required: ');
            this.writeRequiredness(writer, arg.type);
            writer.write(',');
            writer.newLine();
            if (arg.defaultValue != null) {
              writer.write(`default: ${JSON.stringify(arg.defaultValue)}`);
              writer.write(',');
              writer.newLine();
            }
          });
          writer.newLine();
          writer.writeLine('}),');
        });
      });
      writer.writeLine('},');
    }
  }

  writeTypeInfo(writer: CodeBlockWriter) {
    const typeMap = this.schema.getTypeMap();
    const gqlTypes = Object.keys(typeMap)
      .map(typeName => typeMap[typeName])
      .filter(type => type.name.slice(0, 2) !== '__' && !builtins.includes(type.name));

    writer.writeLine('Context: {}');
    const objects = gqlTypes.filter(
      type =>
        type instanceof GraphQLObjectType &&
        type.name !== 'Query' &&
        type.name !== 'Mutation' &&
        type.name !== 'Subscription',
    ) as GraphQLObjectType[];
    if (objects.length !== 0) {
      writer.writeLine('Object: {');
      writer.indent(() => {
        objects.forEach(type => {
          writer.writeLine(`${type.name}: unknown,`);
        });
      });
      writer.writeLine('},');
    }

    const interfaces = gqlTypes.filter(
      type => type instanceof GraphQLInterfaceType,
    ) as GraphQLInterfaceType[];
    if (interfaces.length !== 0) {
      writer.writeLine('Interface: {');
      writer.indent(() => {
        interfaces.forEach(type => {
          writer.writeLine(`${type.name}: unknown,`);
        });
      });
      writer.writeLine('},');
    }

    const inputs = gqlTypes.filter(
      type => type instanceof GraphQLInputObjectType && isRecursive(type),
    ) as GraphQLInputObjectType[];
    if (inputs.length !== 0) {
      writer.writeLine('Input: {');
      writer.indent(() => {
        inputs.forEach(type => {
          writer.writeLine(`${type.name}: ${type.name}Shape`);
        });
      });
      writer.writeLine('},');
    }

    const scalars = gqlTypes.filter(
      type => type instanceof GraphQLScalarType,
    ) as GraphQLScalarType[];
    if (scalars.length !== 0) {
      writer.writeLine('Scalar: {');
      writer.indent(() => {
        scalars.forEach(type => {
          writer.writeLine(`${type.name}: { Input: unknown, Output: unknown },`);
        });
      });
      writer.writeLine('},');
    }
  }

  toString() {
    return this.sourcefile.print();
  }

  async saveAs(filePath: string) {
    await this.sourcefile.copyImmediately(filePath);
  }
}
