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
  FieldsShape,
  RootFieldsShape,
  ResolverMap,
  CompatibleInterfaceParam,
  TypeParam,
  FieldMap,
  RootName,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import BuildCache from './build-cache';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';
import { InputFieldBuilder, RootFieldBuilder, FieldBuilder } from '.';
import { BasePlugin, mergePlugins } from './plugins';
import QueryType from './graphql/query';
import MutationType from './graphql/mutation';
import SubscriptionType from './graphql/subscription';

export default class SchemaBuilder<Types extends GiraphQLSchemaTypes.TypeInfo> {
  private plugin: Required<BasePlugin>;

  private types = new Map<string, ImplementedType>();

  private pendingFields = new Map<string, (FieldSet<Types, unknown> | RootFieldSet<Types>)[]>();

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
    shape?: FieldsShape<Types, Types['Object'][Type], 'Object'>,
  ) {
    const type = this.addType(
      new ObjectType<Types>(
        name,
        options as GiraphQLSchemaTypes.ObjectTypeOptions<Types, Types['Object'][Type]>,
      ),
    );

    if (shape) {
      this.addFields(new FieldSet<Types, Types['Object'][Type]>(name, shape));
    }

    if (options.shape) {
      this.addFields(new FieldSet<Types, Types['Object'][Type]>(name, options.shape));
    }

    return type;
  }

  objectFields<Type extends ObjectName<Types>>(
    name: Type,
    shape: FieldsShape<Types, Types['Object'][Type], 'Object'>,
  ) {
    return this.addFields(new FieldSet<Types, Types['Object'][Type]>(name, shape));
  }

  queryType(
    options: GiraphQLSchemaTypes.QueryTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Query'>,
  ) {
    const type = this.addType(new QueryType<Types>(options));

    if (shape) {
      this.addFields(new RootFieldSet('Query', shape));
    }

    if (options.shape) {
      this.addFields(new RootFieldSet('Query', options.shape));
    }

    return type;
  }

  queryFields(shape: RootFieldsShape<Types, 'Query'>) {
    return this.addFields(new RootFieldSet('Query', shape));
  }

  mutationType(
    options: GiraphQLSchemaTypes.MutationTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Mutation'>,
  ) {
    const type = this.addType(new MutationType<Types>(options));

    if (shape) {
      this.addFields(new RootFieldSet('Mutation', shape));
    }

    if (options.shape) {
      this.addFields(new RootFieldSet('Mutation', options.shape));
    }

    return type;
  }

  mutationFields(shape: RootFieldsShape<Types, 'Mutation'>) {
    return this.addFields(new RootFieldSet('Mutation', shape));
  }

  subscriptionType(
    options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>,
    shape?: RootFieldsShape<Types, 'Subscription'>,
  ) {
    const type = this.addType(new SubscriptionType<Types>(options));

    if (shape) {
      this.addFields(new RootFieldSet('Subscription', shape));
    }

    if (options.shape) {
      this.addFields(new RootFieldSet('Subscription', options.shape));
    }

    return type;
  }

  subscriptionFields(shape: RootFieldsShape<Types, 'Subscription'>) {
    return this.addFields(new RootFieldSet('Subscription', shape));
  }

  args<Shape extends InputFields<Types>>(
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, Types['Interface'][Type]>,
    shape?: FieldsShape<Types, Types['Interface'][Type], 'Interface'>,
  ) {
    const type = this.addType(new InterfaceType<Types, Type>(name, options));

    if (shape) {
      this.addFields(new FieldSet(name, shape));
    }

    if (options.shape) {
      this.addFields(new FieldSet(name, options.shape));
    }

    return type;
  }

  interfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: FieldsShape<Types, Types['Interface'][Type], 'Interface'>,
  ) {
    return this.addFields(new FieldSet(name, shape));
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
        name,
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

    const builtTypes = [...buildCache.types.values()].map(entry => entry.built);

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

    return schema;
  }

  addType<T extends ImplementedType>(type: T) {
    this.types.set(type.typename, type);

    this.plugin.onType(type, this);

    const pending = this.pendingFields.get(type.typename);

    if (pending) {
      this.pendingFields.delete(type.typename);
      for (const fieldSet of pending) {
        this.addFields(fieldSet);
      }
    }

    return type;
  }

  addFields<T extends FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types>>(fieldSet: T) {
    const type = this.types.get(fieldSet.forType);

    if (type) {
      let fields: FieldMap;

      if (fieldSet.kind === 'RootFieldSet') {
        fields = (fieldSet.shape as RootFieldsShape<Types, RootName>)(
          new RootFieldBuilder(fieldSet.forType),
        );
      } else {
        fields = (fieldSet.shape as FieldsShape<Types, TypeParam<Types>>)(
          new FieldBuilder(fieldSet.forType),
        );
      }

      if (this.fields.has(fieldSet.forType)) {
        this.fields.get(fieldSet.forType)!.push(fields);
      } else {
        this.fields.set(fieldSet.forType, [fields]);
      }

      Object.keys(fields).forEach(fieldName => {
        this.plugin.onField(type, fieldName, fields[fieldName], this);
      });
    } else if (this.pendingFields.has(fieldSet.forType)) {
      this.pendingFields.get(fieldSet.forType)!.push(fieldSet);
    } else {
      this.pendingFields.set(fieldSet.forType, [fieldSet]);
    }

    return fieldSet;
  }
}
