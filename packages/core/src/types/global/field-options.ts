/* eslint-disable @typescript-eslint/no-empty-interface */
/* eslint-disable @typescript-eslint/no-unused-vars */
import type { GraphQLFieldExtensions } from 'graphql';
import { FieldRef } from '../../refs/field';
import type {
  ArgFieldMap,
  BaseFieldOptionsForMode,
  FieldKind,
  FieldMode,
  InputFieldMap,
  InputShapeFromFields,
  Resolver,
  Subscriber,
} from '../builder-options';
import type { SchemaTypes } from '../schema-types';
import type {
  FieldNullability,
  FieldRequiredness,
  InputShapeFromTypeParam,
  InputType,
  ShapeFromTypeParam,
  TypeParam,
} from '../type-params';

declare global {
  export namespace PothosSchemaTypes {
    export interface BaseFieldOptionsByMode<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable,
      Args extends InputFieldMap = {},
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
      Kind extends FieldKind = FieldKind,
      Mode extends FieldMode = never,
    > {
      v3: [Mode] extends ['v3']
        ? (options: {
            /** The type for this field */
            type: Type & TypeParam<Types>;
            /** Determines if the field can resolve to a null */
            nullable?: FieldNullability<Type> & Nullable;
            /** arguments for this field (created via `t.args`) */
            args?: ArgFieldMap<Types> & Args;
            /** text description for this field.  This will be added into your schema file and visable in tools like graphql-playground */
            description?: string;
            /** When present marks this field as deprecated */
            deprecationReason?: string;
            /** extensions for this field for use by directives, server plugins or other tools that depend on extensions */
            extensions?: GraphQLFieldExtensions<
              ParentShape,
              Types['Context'],
              InputShapeFromFields<Args>
            >;
            /**
             * Resolver function for this field
             * @param parent - The parent object for the current type
             * @param {object} args - args object based on the args defined for this field
             * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
             * @param {GraphQLResolveInfo} info - info about how this field was queried
             */
            resolve?: Resolver<
              ResolveShape,
              InputShapeFromFields<Args>,
              Types['Context'],
              ShapeFromTypeParam<Types, Type, Nullable>,
              ResolveReturnShape
            >;
          }) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>
        : never;
      v4: [Mode] extends ['v4']
        ? (options: {
            /** The type for this field */
            type: Type;
            /** When true errors will propagate to parent fields, and the resolver will not be able to return null */
            nonNullable?: FieldNullability<Type> & Nullable;
            /** arguments for this field (created via `t.args`) */
            args?: Args & InputFieldMap;
            /** text description for this field.  This will be added into your schema file and visible in tools like graphql-playground */
            description?: string;
            /** When present marks this field as deprecated */
            deprecationReason?: string;
            /** extensions for this field for use by directives, server plugins or other tools that depend on extensions */
            extensions?: GraphQLFieldExtensions<
              ParentShape,
              Types['Context'],
              InputShapeFromFields<Args>
            >;
            /**
             * Resolver function for this field
             * @param parent - The parent object for the current type
             * @param {object} args - args object based on the args defined for this field
             * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
             * @param {GraphQLResolveInfo} info - info about how this field was queried
             */
            resolve?: Resolver<
              ResolveShape,
              InputShapeFromFields<Args>,
              Types['Context'],
              ShapeFromTypeParam<Types, Type, Nullable>,
              ResolveReturnShape
            >;
          }) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>, Kind>
        : never;
    }
    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {}

    export interface ObjectFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {}

    export interface QueryFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        Types['Root'],
        ResolveReturnShape
      > {}

    export interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        Types['Root'],
        ResolveReturnShape
      > {}

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ParentShape,
        ResolveReturnShape
      > {}

    export interface SubscriptionFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > extends FieldOptions<
        Types,
        Types['Root'],
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      > {
      /**
       * Resolver function for this field
       * @param root - The root object for this request
       * @param {object} args - args object based on the args defined for this field
       * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
       * @param {GraphQLResolveInfo} info - info about how this field was queried
       */
      subscribe: Subscriber<
        Types['Root'],
        InputShapeFromFields<Args>,
        Types['Context'],
        ResolveShape
      >;
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
      Kind,
      Mode extends FieldMode,
    > {
      Query: [Kind] extends ['Query']
        ? BaseFieldOptionsForMode<
            Types,
            Types['Root'],
            Type,
            Nullable,
            Args,
            ResolveShape,
            ResolveReturnShape,
            Kind,
            Mode
          > &
            QueryFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>
        : never;
      Mutation: [Kind] extends ['Mutation']
        ? BaseFieldOptionsForMode<
            Types,
            Types['Root'],
            Type,
            Nullable,
            Args,
            ResolveShape,
            ResolveReturnShape,
            Kind,
            Mode
          > &
            MutationFieldOptions<Types, Type, Nullable, Args, ResolveReturnShape>
        : never;
      Subscription: [Kind] extends ['Subscription']
        ? BaseFieldOptionsForMode<
            Types,
            ParentShape,
            Type,
            Nullable,
            Args,
            ResolveShape,
            ResolveReturnShape,
            Kind,
            Mode
          > &
            SubscriptionFieldOptions<Types, Type, Nullable, Args, ResolveShape, ResolveReturnShape>
        : never;
      Object: [Kind] extends ['Object']
        ? BaseFieldOptionsForMode<
            Types,
            ParentShape,
            Type,
            Nullable,
            Args,
            ParentShape,
            ResolveReturnShape,
            Kind,
            Mode
          > &
            ObjectFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>
        : never;
      Interface: [Kind] extends ['Interface']
        ? BaseFieldOptionsForMode<
            Types,
            ParentShape,
            Type,
            Nullable,
            Args,
            ParentShape,
            ResolveReturnShape,
            Kind,
            Mode
          > &
            InterfaceFieldOptions<Types, ParentShape, Type, Nullable, Args, ResolveReturnShape>
        : never;
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > {
      /** The type for this field */
      type: Type;
      /** text description for this field.  This will be added into your schema file and visable in tools like graphql-playground */
      description?: string;
      /** When present marks this field as deprecated */
      deprecationReason?: string;
      /** determines if this field can be omitted (or set as null) */
      required?: Req;
      /** default value if this field is not included in the query */
      defaultValue?: InputShapeFromTypeParam<Types, Type, Req>;
      /** extensions for this field for use by directives, server plugins or other tools that depend on extensions */
      extensions?: Readonly<Record<string, unknown>>;
    }

    export interface ArgFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > extends InputFieldOptions<Types, Type, Req> {}

    export interface InputObjectFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > extends InputFieldOptions<Types, Type, Req> {}

    export interface InputFieldOptionsByKind<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
      Kind = unknown,
    > {
      Arg: [Kind] extends ['Arg'] ? ArgFieldOptions<Types, Type, Req> : never;
      InputObject: [Kind] extends ['InputObject']
        ? InputObjectFieldOptions<Types, Type, Req>
        : never;
    }
  }
}
