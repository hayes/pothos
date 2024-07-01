import {
  GraphQLEnumType,
  GraphQLEnumValue,
  GraphQLField,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLType,
  GraphQLUnionType,
} from 'graphql';
import {
  CodeBlockWriter,
  Project,
  SourceFile,
  StructureKind,
  VariableDeclarationKind,
} from 'ts-morph';

const builtins = ['Boolean', 'Int', 'Float', 'String', 'ID'];

function unwrap(type: GraphQLType): GraphQLNamedType {
  if (type instanceof GraphQLNonNull) {
    return unwrap(type.ofType as GraphQLType);
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
  const fields = Object.keys(fieldMap).map((name) => fieldMap[name]);

  return fields.some((field) => {
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

export default class PothosConverter {
  project = new Project();

  schema: GraphQLSchema;

  sourcefile: SourceFile;

  types: string[] | null;

  constructor(schema: GraphQLSchema, { types }: { types?: string[] | null } = {}) {
    this.schema = schema;
    this.sourcefile = this.project.createSourceFile('./codegen/schema.ts');

    this.types = types ?? null;

    this.createSchemaTypes();
  }

  createSchemaTypes() {
    const typeMap = this.schema.getTypeMap();

    const gqlTypes = Object.keys(typeMap).map((typeName) => typeMap[typeName]);

    if (!this.types) {
      this.sourcefile.addImportDeclaration({
        kind: StructureKind.ImportDeclaration,
        moduleSpecifier: '@pothos/core',
        defaultImport: 'SchemaBuilder',
      });

      this.sourcefile.addStatements((writer) => writer.blankLine());

      this.sourcefile.addVariableStatement({
        kind: StructureKind.VariableStatement,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            kind: StructureKind.VariableDeclaration,
            name: 'builder',
            initializer: (writer) => {
              writer.writeLine('new SchemaBuilder<{');
              writer.indent(() => {
                this.writeTypeInfo(writer);
              });
              writer.writeLine('}>({})');
            },
          },
        ],
      });
    }

    gqlTypes.forEach((type) => {
      if (type.name.startsWith('__') || builtins.includes(type.name)) {
        return;
      }

      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type instanceof GraphQLUnionType) {
        this.unionType(type);
      } else if (type instanceof GraphQLEnumType) {
        this.enumType(type);
      } else if (type instanceof GraphQLScalarType) {
        this.scalarType(type);
      }
    });

    gqlTypes.forEach((type) => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type instanceof GraphQLInputObjectType) {
        this.inputType(type);
      }
    });

    gqlTypes.forEach((type) => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }
      if (this.types && !this.types.includes(type.name)) {
        return;
      }
      if (type instanceof GraphQLInterfaceType) {
        this.interfaceType(type);
      }
    });

    gqlTypes.forEach((type) => {
      if (this.types && !this.types.includes(type.name)) {
        return;
      }

      if (type.name.startsWith('__')) {
        return;
      }

      if (type instanceof GraphQLObjectType) {
        switch (type.name) {
          case 'Query':
            this.queryType(type);
            break;
          case 'Mutation':
            this.mutationType(type);
            break;
          case 'Subscription':
            this.subscriptionType(type);
            break;
          default:
            this.objectType(type);
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
            initializer: (writer) => {
              writer.writeLine('builder.toSchema()');
            },
          },
        ],
      });
    }
  }

  queryType(type: GraphQLObjectType) {
    this.sourcefile.addStatements((writer) => {
      writer.writeLine('builder.queryType({');
      writer.indent(() => {
        this.writeDescription(writer, type);
        this.writeObjectShape(writer, type);
      });
      writer.writeLine('})');
    });
  }

  mutationType(type: GraphQLObjectType) {
    this.sourcefile.addStatements((writer) => {
      writer.writeLine('builder.mutationType({');
      writer.indent(() => {
        this.writeDescription(writer, type);
        this.writeObjectShape(writer, type);
      });
      writer.writeLine('})');
    });
  }

  subscriptionType(type: GraphQLObjectType) {
    this.sourcefile.addStatements((writer) => {
      writer.writeLine('builder.subscriptionType({');
      writer.indent(() => {
        this.writeDescription(writer, type);
        this.writeObjectShape(writer, type);
      });
      writer.writeLine('})');
    });
  }

  objectType(type: GraphQLObjectType) {
    this.sourcefile.addStatements((writer) => {
      writer.writeLine(`builder.objectType('${type.name}', {`);
      writer.indent(() => {
        this.writeDescription(writer, type);
        if (type.getInterfaces().length > 0) {
          writer.writeLine(
            `interfaces: [${type
              .getInterfaces()
              .map((i) => i.name)
              .join(', ')}],`,
          );
          writer.writeLine(
            `isTypeOf: (obj, context, info) => { throw new Error('Not implemented') },`,
          );
        }
        this.writeObjectShape(writer, type);
      });
      writer.writeLine('})');
    });
  }

  interfaceType(type: GraphQLInterfaceType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: (writer) => {
            writer.writeLine(`builder.interfaceType('${type.name}', {`);
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

  unionType(type: GraphQLUnionType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: (writer) => {
            writer.writeLine(`builder.unionType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              writer.writeLine(`types: [${type.getTypes().map((t) => `'${t.name}'`)}],`);
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

  scalarType(type: GraphQLScalarType) {
    this.sourcefile.addStatements((writer) => {
      writer.writeLine(`builder.scalarType('${type.name}', {`);
      writer.indent(() => {
        writer.writeLine(`serialize: () => { throw new Error('Not implemented') },`);
      });
      writer.writeLine('})');
    });
  }

  inputType(type: GraphQLInputObjectType) {
    const recursive = isRecursive(type);
    if (recursive) {
      this.inputTypeShape(type);

      this.sourcefile.addVariableStatement({
        kind: StructureKind.VariableStatement,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            kind: StructureKind.VariableDeclaration,
            name: type.name,
            initializer: (writer) => {
              writer.writeLine(`builder.inputRef<${type.name}Shape>('${type.name}')`);
            },
          },
        ],
      });

      this.sourcefile.addStatements((writer) => {
        writer.newLine();
        writer.writeLine(`${type.name}.implement({`);
        writer.indent(() => {
          this.writeDescription(writer, type);
          this.writeInputShape(writer, type);
        });
        writer.writeLine('})');
      });
    } else {
      this.sourcefile.addVariableStatement({
        kind: StructureKind.VariableStatement,
        declarationKind: VariableDeclarationKind.Const,
        declarations: [
          {
            kind: StructureKind.VariableDeclaration,
            name: type.name,
            initializer: (writer) => {
              writer.writeLine(`builder.inputType('${type.name}', {`);
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
  }

  inputTypeShape(type: GraphQLInputObjectType) {
    const fieldMap = type.getFields();
    const fields = Object.keys(fieldMap).map((name) => fieldMap[name]);

    this.sourcefile.addInterface({
      kind: StructureKind.Interface,
      name: `${type.name}Shape`,
      properties: fields.map((field) => ({
        name: field.name,
        type: (writer) => void this.writeInputFieldShape(writer, field.type, type),
      })),
    });
  }

  enumType(type: GraphQLEnumType) {
    this.sourcefile.addVariableStatement({
      kind: StructureKind.VariableStatement,
      declarationKind: VariableDeclarationKind.Const,
      declarations: [
        {
          kind: StructureKind.VariableDeclaration,
          name: type.name,
          initializer: (writer) => {
            writer.writeLine(`builder.enumType('${type.name}', {`);
            writer.indent(() => {
              this.writeDescription(writer, type);
              writer.writeLine('values: {');
              writer.indent(() => {
                type.getValues().forEach((value) => {
                  writer.writeLine(`${value.name}: {`);
                  writer.indent(() => {
                    this.writeDescription(writer, value);
                    writer.write(`value: `);
                    if (value.value) {
                      writer.write(
                        typeof value.value === 'number'
                          ? `${value.value} as const,`
                          : `'${value.value}' as const,`,
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

  writeObjectShape(writer: CodeBlockWriter, type: GraphQLInterfaceType | GraphQLObjectType) {
    const fieldMap = type.getFields();
    const inheritedFields =
      type instanceof GraphQLObjectType
        ? type.getInterfaces().flatMap((i) => Object.keys(i.getFields()))
        : [];
    const fields = Object.keys(fieldMap).map((f) => fieldMap[f]);
    writer.writeLine('fields: t => ({');
    writer.indent(() => {
      fields.forEach((field) => {
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
          this.writeNullability(writer, field.type);
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
    writer.writeLine('fields: t => ({');
    writer.indent(() => {
      const fieldMap = type.getFields();
      const fields = Object.keys(fieldMap).map((name) => fieldMap[name]);

      fields.forEach((field) => {
        writer.writeLine(`${field.name}: t.field({`);
        writer.indent(() => {
          writer.write('type: ');
          this.writeType(writer, field.type);
          writer.write(',');
          writer.newLine();
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
    type: GraphQLEnumValue | GraphQLField<unknown, unknown> | GraphQLInputField | GraphQLNamedType,
  ) {
    if (type.description) {
      writer.write('description:');
      writer.quote(type.description);
      writer.writeLine(',');
    }
  }

  writeType(writer: CodeBlockWriter, type: GraphQLType): void {
    if (type instanceof GraphQLNonNull) {
      this.writeType(writer, type.ofType as GraphQLType);

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
      type instanceof GraphQLInterfaceType
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
          writer.write('(string | number)');
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
        throw new Error(type.toString());
      } else {
        writer.write('{');
        writer.newLine();
        writer.indent(() => {
          const fieldMap = type.getFields();
          const fields = Object.keys(fieldMap).map((name) => fieldMap[name]);

          fields.forEach((field) => {
            writer.write(`${field.name}: `);
            this.writeInputFieldShape(writer, field.type, rootType);
            writer.write(';');
            writer.newLine();
          });
        });
        writer.newLine();
        writer.write('}');
      }
    } else if (type instanceof GraphQLEnumType) {
      writer.write(
        type
          .getValues()
          .map(({ value }) => (typeof value === 'string' ? `'${value}'` : `${value}`))
          .join(' | '),
      );
    } else {
      writer.write(rootType.name);
    }

    if (!(wrappedType instanceof GraphQLNonNull)) {
      writer.write('| null | undefined');
    }
  }

  writeNullability(writer: CodeBlockWriter, type: GraphQLType) {
    if (type instanceof GraphQLNonNull) {
      if (type.ofType instanceof GraphQLList && !(type.ofType.ofType instanceof GraphQLNonNull)) {
        writer.write('nullable: { list: false, items: true },');
      } else {
        writer.write('nullable: false,');
      }
    } else if (type instanceof GraphQLList && !(type.ofType instanceof GraphQLNonNull)) {
      writer.write(`nullable: { list: false, items: true },`);
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
    if (type.args.length > 0) {
      writer.write('args: {');
      writer.indent(() => {
        type.args.forEach((arg) => {
          writer.writeLine(`${arg.name}: t.arg({`);
          writer.indent(() => {
            writer.write('type: ');
            this.writeType(writer, arg.type);
            writer.write(',');
            writer.newLine();
            this.writeDescription(writer, arg);
            writer.write('required: ');
            this.writeRequiredness(writer, arg.type);
            writer.write(',');
            writer.newLine();
            if (arg.defaultValue != null) {
              writer.write(`defaultValue: ${JSON.stringify(arg.defaultValue)}`);
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
      .map((typeName) => typeMap[typeName])
      .filter((type) => !type.name.startsWith('__') && !builtins.includes(type.name));

    writer.writeLine('Context: {}');
    const objects = gqlTypes.filter(
      (type) =>
        type instanceof GraphQLObjectType &&
        type.name !== 'Query' &&
        type.name !== 'Mutation' &&
        type.name !== 'Subscription',
    ) as GraphQLObjectType[];
    if (objects.length > 0) {
      writer.writeLine('Objects: {');
      writer.indent(() => {
        objects.forEach((type) => {
          writer.writeLine(`${type.name}: unknown,`);
        });
      });
      writer.writeLine('},');
    }

    const interfaces = gqlTypes.filter(
      (type) => type instanceof GraphQLInterfaceType,
    ) as GraphQLInterfaceType[];
    if (interfaces.length > 0) {
      writer.writeLine('Interfaces: {');
      writer.indent(() => {
        interfaces.forEach((type) => {
          writer.writeLine(`${type.name}: unknown,`);
        });
      });
      writer.writeLine('},');
    }

    const scalars = gqlTypes.filter(
      (type) => type instanceof GraphQLScalarType,
    ) as GraphQLScalarType[];
    if (scalars.length > 0) {
      writer.writeLine('Scalars: {');
      writer.indent(() => {
        scalars.forEach((type) => {
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
