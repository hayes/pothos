/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable node/no-callback-literal */
import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLScalarType,
  GraphQLString,
} from 'graphql';
import { PothosError, PothosSchemaError } from './errors';
import BaseTypeRef from './refs/base';
import BuiltinScalarRef from './refs/builtin-scalar';
import FieldRef from './refs/field';
import InputTypeRef from './refs/input';
import InputFieldRef from './refs/input-field';
import InputListRef from './refs/input-list';
import ListRef from './refs/list';
import OutputTypeRef from './refs/output';
import type {
  ConfigurableRef,
  FieldMap,
  GraphQLFieldKind,
  InputFieldMap,
  InputRef,
  InputType,
  InputTypeParam,
  InterfaceParam,
  ObjectParam,
  OutputRef,
  OutputType,
  PothosFieldConfig,
  PothosObjectTypeConfig,
  PothosTypeConfig,
  SchemaTypes,
  TypeParam,
} from './types';
import { unwrapListParam } from './utils';

export default class ConfigStore<Types extends SchemaTypes> {
  typeConfigs = new Map<string, PothosTypeConfig>();

  private fieldRefs = new WeakMap<
    FieldRef | InputFieldRef,
    (
      name: string,
      parentField: string | undefined,
      typeConfig: PothosTypeConfig,
    ) => PothosFieldConfig<Types>
  >();

  private fields = new Map<string, Map<string, PothosFieldConfig<Types>>>();

  private pendingActions: (() => void)[] = [];

  private refsToName = new Map<ConfigurableRef<Types>, string>();

  private scalarsToRefs = new Map<string, BuiltinScalarRef<unknown, unknown>>();

  private fieldRefsToConfigs = new Map<FieldRef | InputFieldRef, PothosFieldConfig<Types>[]>();

  private pendingFields = new Map<FieldRef | InputFieldRef, InputType<Types> | OutputType<Types>>();

  private pendingRefResolutions = new Map<
    ConfigurableRef<Types>,
    ((config: PothosTypeConfig) => void)[]
  >();

  private fieldRefCallbacks = new Map<
    FieldRef | InputFieldRef,
    ((config: PothosFieldConfig<Types>) => void)[]
  >();

  private pending = true;

  constructor() {
    const scalars: GraphQLScalarType[] = [
      GraphQLID,
      GraphQLInt,
      GraphQLFloat,
      GraphQLString,
      GraphQLBoolean,
    ];

    scalars.forEach((scalar) => {
      const ref = new BuiltinScalarRef(scalar);
      this.scalarsToRefs.set(scalar.name, ref);
      this.refsToName.set(ref, scalar.name);
    });
  }

  hasConfig(typeParam: InputType<Types> | OutputType<Types>) {
    if (typeof typeParam === 'string') {
      return this.typeConfigs.has(typeParam);
    }

    return this.refsToName.has(typeParam);
  }

  addUnionTypes(typeName: string, unionTypes: ObjectParam<Types>[] | (() => ObjectParam<Types>[])) {
    this.onPrepare(() => {
      const typeConfig = this.getTypeConfig(typeName);

      if (typeConfig.graphqlKind !== 'Union') {
        throw new PothosSchemaError(
          `Can not add types to ${typeName} because it is a ${typeConfig.kind}`,
        );
      }

      typeConfig.types = [
        ...typeConfig.types,
        ...((typeof unionTypes === 'function'
          ? unionTypes()
          : unionTypes) as ObjectParam<SchemaTypes>[]),
      ];
    });
  }

  addInterfaces(
    typeName: string,
    interfaces: InterfaceParam<Types>[] | (() => InterfaceParam<Types>[]),
  ) {
    this.onPrepare(() => {
      const typeConfig = this.getTypeConfig(typeName);

      if (
        (typeConfig.graphqlKind !== 'Object' && typeConfig.graphqlKind !== 'Interface') ||
        typeConfig.kind === 'Query' ||
        typeConfig.kind === 'Mutation' ||
        typeConfig.kind === 'Subscription'
      ) {
        throw new PothosSchemaError(
          `Can not add interfaces to ${typeName} because it is a ${typeConfig.kind}`,
        );
      }

      typeConfig.interfaces = [
        ...typeConfig.interfaces,
        ...((typeof interfaces === 'function'
          ? interfaces()
          : interfaces) as InterfaceParam<SchemaTypes>[]),
      ];
    });
  }

  addFieldRef(
    ref: FieldRef | InputFieldRef,
    // We need to be able to resolve the types kind before configuring the field
    typeParam: InputTypeParam<Types> | TypeParam<Types>,
    args: InputFieldMap,
    getConfig: (
      name: string,
      parentField: string | undefined,
      typeConfig: PothosTypeConfig,
    ) => PothosFieldConfig<Types>,
  ) {
    if (this.fieldRefs.has(ref)) {
      throw new PothosSchemaError(`FieldRef ${String(ref)} has already been added to config store`);
    }

    const typeRefOrName = unwrapListParam(typeParam);
    const argRefs = Object.keys(args).map((argName) => {
      const argRef = args[argName];

      argRef.fieldName = argName;
      argRef.argFor = ref;

      return argRef;
    });

    const checkArgs = () => {
      for (const arg of argRefs) {
        if (this.pendingFields.has(arg)) {
          const unresolvedArgType = this.pendingFields.get(arg)!;
          this.pendingFields.set(ref, unresolvedArgType);

          this.onTypeConfig(unresolvedArgType, checkArgs);

          return;
        }
      }

      this.pendingFields.delete(ref);
      this.fieldRefs.set(ref, getConfig);
    };

    if (
      this.hasConfig(typeRefOrName) ||
      typeRefOrName instanceof BaseTypeRef ||
      this.scalarsToRefs.has(typeRefOrName as string)
    ) {
      checkArgs();
    } else {
      this.pendingFields.set(ref, typeRefOrName);
      this.onTypeConfig(typeRefOrName, () => {
        checkArgs();
      });
    }
  }

  createFieldConfig<T extends GraphQLFieldKind>(
    ref: FieldRef | InputFieldRef,
    name: string,
    typeConfig: PothosTypeConfig,
    parentField?: string,
    kind?: T,
  ): Extract<PothosFieldConfig<Types>, { graphqlKind: T }> {
    if (!this.fieldRefs.has(ref)) {
      if (this.pendingFields.has(ref)) {
        throw new PothosSchemaError(
          `Missing implementation for ${this.describeRef(
            this.pendingFields.get(ref)!,
          )} used in field ${name} of ${typeConfig.name}`,
        );
      }

      throw new PothosSchemaError(`Missing definition for ${String(ref)}`);
    }

    const config = this.fieldRefs.get(ref)!(name, parentField, typeConfig);

    if (kind && config.graphqlKind !== kind) {
      throw new PothosError(
        `Expected ref for field named ${name} to resolve to a ${kind} type, but got ${config.graphqlKind}`,
      );
    }

    return config as Extract<PothosFieldConfig<Types>, { graphqlKind: T }>;
  }

  associateRefWithName(ref: ConfigurableRef<Types>, name: string) {
    if (!this.typeConfigs.has(name)) {
      throw new PothosSchemaError(`${name} has not been implemented yet`);
    }

    this.refsToName.set(ref, name);

    if (this.pendingRefResolutions.has(ref)) {
      const cbs = this.pendingRefResolutions.get(ref)!;

      this.pendingRefResolutions.delete(ref);

      cbs.forEach((cb) => void cb(this.typeConfigs.get(name)!));
    }
  }

  addTypeConfig(config: PothosTypeConfig, ref?: ConfigurableRef<Types>) {
    const { name } = config;

    if (this.typeConfigs.has(name)) {
      throw new PothosSchemaError(
        `Duplicate typename: Another type with name ${name} already exists.`,
      );
    }

    this.typeConfigs.set(config.name, config);

    if (ref) {
      this.associateRefWithName(ref, name);
    }

    if (this.pendingRefResolutions.has(name as ConfigurableRef<Types>)) {
      const cbs = this.pendingRefResolutions.get(name as ConfigurableRef<Types>)!;

      this.pendingRefResolutions.delete(name as ConfigurableRef<Types>);

      cbs.forEach((cb) => void cb(config));
    }
  }

  getTypeConfig<T extends PothosTypeConfig['kind']>(
    ref: ConfigurableRef<Types> | string,
    kind?: T,
  ) {
    let config: PothosTypeConfig;

    if (typeof ref === 'string') {
      if (!this.typeConfigs.has(ref)) {
        throw new PothosSchemaError(`Type ${String(ref)} has not been implemented`);
      }
      config = this.typeConfigs.get(ref)!;
    } else if (this.refsToName.has(ref)) {
      config = this.typeConfigs.get(this.refsToName.get(ref)!)!;
    } else if (ref instanceof ListRef || ref instanceof InputListRef) {
      throw new PothosSchemaError(
        `Expected a base type but got a ${ref.kind} of ${String(ref.listType)}`,
      );
    } else {
      throw new PothosSchemaError(`Ref ${String(ref)} has not been implemented`);
    }

    if (kind && config.graphqlKind !== kind) {
      throw new PothosSchemaError(
        `Expected ref to resolve to a ${kind} type, but got ${config.kind}`,
      );
    }

    return config as Extract<PothosTypeConfig, { kind: T }>;
  }

  getInputTypeRef(ref: ConfigurableRef<Types> | string) {
    if (ref instanceof BaseTypeRef) {
      if (ref.kind !== 'InputObject' && ref.kind !== 'Enum' && ref.kind !== 'Scalar') {
        throw new PothosSchemaError(`Expected ${ref.name} to be an input type but got ${ref.kind}`);
      }

      return ref as InputRef;
    }

    if (typeof ref === 'string') {
      if (this.scalarsToRefs.has(ref)) {
        return this.scalarsToRefs.get(ref)!;
      }

      if (this.typeConfigs.has(ref)) {
        const config = this.typeConfigs.get(ref)!;

        if (
          config.graphqlKind !== 'InputObject' &&
          config.graphqlKind !== 'Enum' &&
          config.graphqlKind !== 'Scalar'
        ) {
          throw new PothosSchemaError(
            `Expected ${config.name} to be an input type but got ${config.graphqlKind}`,
          );
        }

        const newRef = new InputTypeRef(config.graphqlKind, config.name);

        this.refsToName.set(newRef, config.name);

        return newRef;
      }
    }

    return ref as InputType<Types>;
  }

  getOutputTypeRef(ref: ConfigurableRef<Types> | string) {
    if (ref instanceof BaseTypeRef) {
      if (ref.kind === 'InputObject' || ref.kind === 'InputList') {
        throw new PothosSchemaError(
          `Expected ${ref.name} to be an output type but got ${ref.kind}`,
        );
      }

      if (ref.kind === 'List') {
        throw new PothosSchemaError(`Expected ${ref.name} to be a base type but got a ${ref.kind}`);
      }

      return ref as OutputRef;
    }

    if (typeof ref === 'string') {
      if (this.scalarsToRefs.has(ref)) {
        return this.scalarsToRefs.get(ref)!;
      }

      if (this.typeConfigs.has(ref)) {
        const config = this.typeConfigs.get(ref)!;

        if (config.graphqlKind === 'InputObject') {
          throw new PothosSchemaError(
            `Expected ${config.name} to be an output type but got ${config.graphqlKind}`,
          );
        }

        const newRef = new OutputTypeRef(config.graphqlKind, config.name);

        this.refsToName.set(newRef, config.name);

        return newRef;
      }
    }

    return ref as OutputType<Types>;
  }

  onTypeConfig(ref: ConfigurableRef<Types>, cb: (config: PothosTypeConfig) => void) {
    if (!ref) {
      throw new PothosSchemaError(`${String(ref)} is not a valid type ref`);
    }
    if (this.refsToName.has(ref)) {
      cb(this.getTypeConfig(ref));
    } else if (typeof ref === 'string' && this.typeConfigs.has(ref)) {
      cb(this.typeConfigs.get(ref)!);
    } else if (!this.pending) {
      throw new PothosSchemaError(`Ref ${String(ref)} has not been implemented`);
    } else if (this.pendingRefResolutions.has(ref)) {
      this.pendingRefResolutions.get(ref)!.push(cb);
    } else {
      this.pendingRefResolutions.set(ref, [cb]);
    }
  }

  onFieldUse(ref: FieldRef | InputFieldRef, cb: (config: PothosFieldConfig<Types>) => void) {
    if (!this.fieldRefCallbacks.has(ref)) {
      this.fieldRefCallbacks.set(ref, []);
    }

    this.fieldRefCallbacks.get(ref)!.push(cb);

    if (this.fieldRefsToConfigs.has(ref)) {
      this.fieldRefsToConfigs.get(ref)!.forEach((config) => void cb(config));
    }
  }

  getFields<T extends GraphQLFieldKind>(
    name: string,
    kind?: T,
  ): Map<string, Extract<PothosFieldConfig<Types>, { graphqlKind: T }>> {
    const typeConfig = this.getTypeConfig(name);

    if (!this.fields.has(name)) {
      this.fields.set(name, new Map());
    }
    const fields = this.fields.get(name)!;

    if (kind && typeConfig.graphqlKind !== kind) {
      throw new PothosSchemaError(
        `Expected ${name} to be a ${kind} type, but found ${typeConfig.graphqlKind}`,
      );
    }

    return fields as Map<string, Extract<PothosFieldConfig<Types>, { graphqlKind: T }>>;
  }

  prepareForBuild() {
    this.pending = false;

    const { pendingActions } = this;

    this.pendingActions = [];

    pendingActions.forEach((fn) => void fn());

    if (this.pendingRefResolutions.size > 0) {
      throw new PothosSchemaError(
        `Missing implementations for some references (${[...this.pendingRefResolutions.keys()]
          .map((ref) => this.describeRef(ref))
          .join(', ')}).`,
      );
    }
  }

  onPrepare(cb: () => void) {
    if (this.pending) {
      this.pendingActions.push(cb);
    } else {
      cb();
    }
  }

  addFields(
    typeRef: ConfigurableRef<Types>,
    fields: FieldMap | InputFieldMap | (() => FieldMap | InputFieldMap),
  ) {
    this.onPrepare(
      () =>
        void this.onTypeConfig(typeRef, (config) => {
          this.buildFields(typeRef, typeof fields === 'function' ? fields() : fields);
        }),
    );
  }

  getImplementers(ref: ConfigurableRef<Types> | string) {
    const typeConfig = this.getTypeConfig(ref, 'Interface');

    const implementers = [...this.typeConfigs.values()].filter(
      (type) =>
        type.kind === 'Object' &&
        type.interfaces.find((i) => this.getTypeConfig(i).name === typeConfig.name),
    ) as PothosObjectTypeConfig[];

    return implementers;
  }

  private describeRef(ref: ConfigurableRef<Types>): string {
    if (typeof ref === 'string') {
      return ref;
    }

    if (ref.toString !== {}.toString) {
      return String(ref);
    }

    const usedBy = [...this.pendingFields.entries()].find(
      ([fieldRef, typeRef]) => typeRef === ref,
    )?.[0];

    if (usedBy) {
      return `<unnamed ref or enum: used by ${usedBy}>`;
    }

    return `<unnamed ref or enum>`;
  }

  private buildFields(typeRef: ConfigurableRef<Types>, fields: FieldMap | InputFieldMap) {
    Object.keys(fields).forEach((fieldName) => {
      const fieldRef = fields[fieldName];

      fieldRef.fieldName = fieldName;

      if (this.pendingFields.has(fieldRef)) {
        this.onTypeConfig(this.pendingFields.get(fieldRef)!, () => {
          this.buildField(typeRef, fieldRef, fieldName);
        });
      } else {
        this.buildField(typeRef, fieldRef, fieldName);
      }
    });
  }

  private buildField(
    typeRef: ConfigurableRef<Types>,
    field: FieldRef | InputFieldRef,
    fieldName: string,
  ) {
    const typeConfig = this.getTypeConfig(typeRef);
    const fieldConfig = this.createFieldConfig(field, fieldName, typeConfig);
    const existingFields = this.getFields(typeConfig.name);

    if (existingFields.has(fieldName)) {
      throw new PothosSchemaError(
        `Duplicate field definition for field ${fieldName} in ${typeConfig.name}`,
      );
    }

    if (fieldConfig.graphqlKind !== typeConfig.graphqlKind) {
      throw new PothosSchemaError(
        `${typeConfig.name}.${fieldName} was defined as a ${fieldConfig.graphqlKind} field but ${typeConfig.name} is a ${typeConfig.graphqlKind}`,
      );
    }

    existingFields.set(fieldName, fieldConfig);

    if (!this.fieldRefsToConfigs.has(field)) {
      this.fieldRefsToConfigs.set(field, []);
    }

    this.fieldRefsToConfigs.get(field)!.push(fieldConfig);

    if (this.fieldRefCallbacks.has(field)) {
      this.fieldRefCallbacks.get(field)!.forEach((cb) => void cb(fieldConfig));
    }
  }
}
