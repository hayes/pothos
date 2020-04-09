/* eslint-disable no-dupe-class-members */
import { GraphQLSchema, GraphQLScalarType, GraphQLDirective } from 'graphql';
import {
  ImplementedType,
  EnumValues,
  InputFields,
  InputShapeFromFields,
  ObjectName,
  InterfaceName,
  ScalarName,
  ResolverMap,
  CompatibleInterfaceParam,
  FieldMap,
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  InterfaceFieldsShape,
  ObjectFieldThunk,
  InterfaceFieldThunk,
  QueryFieldThunk,
  MutationFieldThunk,
  SubscriptionFieldThunk,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import BuildCache from './build-cache';
import {
  InputFieldBuilder,
  ObjectFieldBuilder,
  QueryFieldBuilder,
  MutationFieldBuilder,
  SubscriptionFieldBuilder,
  InterfaceFieldBuilder,
} from '.';
import { BasePlugin, mergePlugins } from './plugins';
import QueryType from './graphql/query';
import MutationType from './graphql/mutation';
import SubscriptionType from './graphql/subscription';

export default class SchemaBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  private plugin: Required<BasePlugin>;

  private types = new Map<string, ImplementedType>();

  private pendingFields = new Map<string, FieldMap[]>();

  private fields = new Map<string, FieldMap[]>();

  constructor(options: { plugins?: BasePlugin[] } = {}) {
    this.plugin = mergePlugins(options.plugins ?? []);
  }

  objectType<
    Interfaces extends CompatibleInterfaceParam<Types, Types['Object'][Type]>[],
    Type extends ObjectName<Types>
  >(
    name: Type,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, Types['Object'][Type]>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
          Types,
          Types['Object'][Type],
          Interfaces
        >,
    shape?: ObjectFieldsShape<Types, Types['Object'][Type]>,
  ) {
    const type = this.addType(
      new ObjectType<Types>(
        name,
        options as GiraphQLSchemaTypes.ObjectTypeOptions<Types, Types['Object'][Type]>,
      ),
    );

    if (shape) {
      this.addFields(name, shape(new ObjectFieldBuilder(name)));
    }

    if (options.shape) {
      this.addFields(name, options.shape(new ObjectFieldBuilder(name)));
    }

    return type;
  }

  objectFields<Type extends ObjectName<Types>>(
    name: Type,
    shape: ObjectFieldsShape<Types, Types['Object'][Type]>,
  ) {
    return this.addFields(name, shape(new ObjectFieldBuilder(name)));
  }

  objectField<Type extends ObjectName<Types>>(
    name: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, Types['Object'][Type]>,
  ) {
    return this.addFields(name, { [fieldName]: field(new ObjectFieldBuilder(name)) });
  }

  queryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>, shape?: QueryFieldsShape<Types>) {
    const type = this.addType(new QueryType<Types>(options));

    if (shape) {
      this.addFields('Query', shape(new QueryFieldBuilder()));
    }

    if (options.shape) {
      this.addFields('Query', options.shape(new QueryFieldBuilder()));
    }

    return type;
  }

  queryFields(shape: QueryFieldsShape<Types>) {
    return this.addFields('Query', shape(new QueryFieldBuilder()));
  }

  queryField(name: string, field: QueryFieldThunk<Types>) {
    return this.addFields('Query', { [name]: field(new QueryFieldBuilder()) });
  }

  mutationType(
    options: GiraphQLSchemaTypes.MutationTypeOptions<Types>,
    shape?: MutationFieldsShape<Types>,
  ) {
    const type = this.addType(new MutationType<Types>(options));

    if (shape) {
      this.addFields('Mutation', shape(new MutationFieldBuilder()));
    }

    if (options.shape) {
      this.addFields('Mutation', options.shape(new MutationFieldBuilder()));
    }

    return type;
  }

  mutationFields(shape: MutationFieldsShape<Types>) {
    return this.addFields('Mutation', shape(new MutationFieldBuilder()));
  }

  mutationField(name: string, field: MutationFieldThunk<Types>) {
    return this.addFields('Mutation', { [name]: field(new MutationFieldBuilder()) });
  }

  subscriptionType(
    options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>,
    shape?: SubscriptionFieldsShape<Types>,
  ) {
    const type = this.addType(new SubscriptionType<Types>(options));

    if (shape) {
      this.addFields('Subscription', shape(new SubscriptionFieldBuilder()));
    }

    if (options.shape) {
      this.addFields('Subscription', options.shape(new SubscriptionFieldBuilder()));
    }

    return type;
  }

  subscriptionFields(shape: SubscriptionFieldsShape<Types>) {
    return this.addFields('Subscription', shape(new SubscriptionFieldBuilder()));
  }

  subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
    return this.addFields('Subscription', { [name]: field(new SubscriptionFieldBuilder()) });
  }

  args<Shape extends InputFields<Types>>(
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, Types['Interface'][Type]>,
    shape?: InterfaceFieldsShape<Types, Types['Interface'][Type]>,
  ) {
    const type = this.addType(new InterfaceType<Types, Type>(name, options));

    if (shape) {
      this.addFields(name, shape(new InterfaceFieldBuilder(name)));
    }

    if (options.shape) {
      this.addFields(name, options.shape(new InterfaceFieldBuilder(name)));
    }

    return type;
  }

  interfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: InterfaceFieldsShape<Types, Types['Interface'][Type]>,
  ) {
    return this.addFields(name, shape(new InterfaceFieldBuilder(name)));
  }

  interfaceField<Type extends InterfaceName<Types>>(
    name: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, Types['Interface'][Type]>,
  ) {
    return this.addFields(name, { [fieldName]: field(new InterfaceFieldBuilder(name)) });
  }

  unionType<Member extends ObjectName<Types>, Name extends string>(
    name: Name,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    return this.addType(new UnionType<Types, Member>(name, options));
  }

  enumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    return this.addType(new EnumType(name, options));
  }

  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.ScalarOptions<
      Types['Scalar'][Name]['Input'],
      Types['Scalar'][Name]['Output']
    >,
  ) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(
        name,
        options,
      ),
    );
  }

  addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    return this.addType(
      new ScalarType<Types['Scalar'][Name]['Input'], Types['Scalar'][Name]['Output']>(name, {
        description: scalar.description ?? undefined,
        serialize: scalar.serialize,
        parseLiteral: scalar.parseLiteral,
        parseValue: scalar.parseValue,
        extensions: scalar.extensions ?? undefined,
      }),
    );
  }

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: Omit<GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>, 'shape'>,
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  inputType<Name extends string, Fields extends InputFields<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
    shape?: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name> {
    if (shape && options.shape) {
      throw new Error(`Received multiple field shape functions for InputObjectType ${name}`);
    }

    return this.addType(
      new InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>(name, {
        ...options,
        shape: shape ?? options.shape,
      }),
    );
  }

  // Temporarily alias old names for compatibility
  createQueryType = this.queryType;

  createMutationType = this.mutationType;

  createSubscriptionType = this.subscriptionType;

  createObjectType = this.objectType;

  createInterfaceType = this.interfaceType;

  createQueryFields = this.queryFields;

  createMutationFields = this.mutationFields;

  createSubscriptionFields = this.subscriptionFields;

  createObjectFields = this.objectFields;

  createInterfaceFields = this.interfaceFields;

  createUnionType = this.unionType;

  createEnumType = this.enumType;

  createScalarType = this.addScalarType;

  createInputType = this.inputType;

  createArgs = this.args;

  toSchema({
    directives,
    extensions,
    mocks,
  }: {
    directives?: readonly GraphQLDirective[];
    extensions?: Record<string, unknown>;
    mocks?: ResolverMap;
  } = {}) {
    this.plugin.beforeBuild(this);

    if (this.pendingFields.size) {
      throw new Error(
        `Fields defined without defining type (${[...this.pendingFields.keys()].join(', ')}).`,
      );
    }

    const buildCache = new BuildCache([...this.types.values()], this.plugin, {
      fieldDefinitions: this.fields,
      mocks,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()].map((entry) => entry.built);

    const schema = new GraphQLSchema({
      query: buildCache.has('Query')
        ? buildCache.getEntryOfType('Query', 'Query').built
        : undefined,
      mutation: buildCache.has('Mutation')
        ? buildCache.getEntryOfType('Mutation', 'Mutation').built
        : undefined,
      subscription: buildCache.has('Subscription')
        ? buildCache.getEntryOfType('Subscription', 'Subscription').built
        : undefined,
      extensions,
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    this.plugin.afterBuild(schema, this);

    return schema;
  }

  addType<T extends ImplementedType>(type: T) {
    this.types.set(type.typename, type);

    this.plugin.onType(type, this);

    const pending = this.pendingFields.get(type.typename);

    if (pending) {
      this.pendingFields.delete(type.typename);
      for (const fields of pending) {
        this.addFields(type.typename, fields);
      }
    }

    return type;
  }

  addFields(typename: string, fields: FieldMap) {
    const type = this.types.get(typename);

    if (type) {
      if (this.fields.has(typename)) {
        this.fields.get(typename)!.push(fields);
      } else {
        this.fields.set(typename, [fields]);
      }

      Object.keys(fields).forEach((fieldName) => {
        this.plugin.onField(type, fieldName, fields[fieldName], this);
      });
    } else if (this.pendingFields.has(typename)) {
      this.pendingFields.get(typename)!.push(fields);
    } else {
      this.pendingFields.set(typename, [fields]);
    }

    return fields;
  }
}
