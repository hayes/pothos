import '@pothos/plugin-directives';
import type {
  FieldNullability,
  FieldRequiredness,
  InferredFieldOptionsByKind,
  InputFieldMap,
  InputType,
  MaybePromise,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import type {
  KeyDirective,
  PothosFederationPlugin,
  Selection,
  SelectionFromShape,
  selectionShapeKey,
} from '.';
import type { ExternalEntityRef } from './external-ref';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      federation: PothosFederationPlugin<Types>;
    }

    export interface PothosKindToGraphQLType {
      ExtendedEntity: 'Object';
      ExternalEntity: 'Object';
      EntityObject: 'Object';
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      ExtendedEntity: ObjectFieldOptions<
        Types,
        ParentShape & ResolveShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      > & {
        requires?: Selection<ResolveShape & object>;
      } & InferredFieldOptionsByKind<
          Types,
          Types['InferredFieldOptionsKind'],
          ParentShape & ResolveShape,
          Type,
          Nullable,
          Args,
          ResolveReturnShape
        >;
      ExternalEntity: ObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;

      EntityObject: ObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      > & {
        resolve: Resolver<
          ParentShape,
          Args,
          Types['Context'],
          Type extends [unknown]
            ? ((ShapeFromTypeParam<Types, Type, false> & unknown[])[number] & ResolveShape)[]
            : ResolveShape & ShapeFromTypeParam<Types, Type, false>,
          ResolveReturnShape
        >;
      };
    }

    export interface BaseFieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      ExtendedEntity: ObjectFieldOptions<
        Types,
        ParentShape & ResolveShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      > & {
        requires?: Selection<ResolveShape & object>;
      };
      ExternalEntity: ObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;
      EntityObject: ObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveReturnShape
      >;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      externalRef: <
        KeySelection extends Selection<object>,
        Shape extends object = KeySelection[typeof selectionShapeKey],
      >(
        name: string,
        key?: KeySelection | KeySelection[],
        resolveReference?: (
          parent: KeySelection[typeof selectionShapeKey],
          context: Types['Context'],
          info: GraphQLResolveInfo,
        ) => MaybePromise<Shape | null | undefined>,
      ) => ExternalEntityRef<Types, Shape, KeySelection>;

      selection: <Shape extends object>(selection: SelectionFromShape<Shape>) => Selection<Shape>;

      keyDirective: <Shape extends object, Resolvable extends boolean = true>(
        key: Selection<Shape>,
        resolvable?: Resolvable,
      ) => KeyDirective<Shape, Resolvable>;

      toSubGraphSchema: (
        options: BuildSchemaOptions<Types> & {
          linkUrl?: string;
          composeDirectives?: `@${string}`[];
          federationDirectives?: string[];
        },
      ) => GraphQLSchema;

      asEntity: <
        Param extends InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
        KeySelection extends Selection<object>,
      >(
        param: Param,
        options: {
          key: KeySelection | KeySelection[];
          resolveReference: (
            parent: KeySelection[typeof selectionShapeKey],
            context: Types['Context'],
            info: GraphQLResolveInfo,
          ) => MaybePromise<ShapeFromTypeParam<Types, Param, true>>;
          interfaceObject?: Param extends ObjectRef<Types, unknown> ? boolean : never;
        },
      ) => void;
    }

    export interface UserSchemaTypes {
      FederationScopes: unknown;
      FederationPolicies: unknown;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      FederationScopes: string extends PartialTypes['FederationScopes']
        ? string
        : PartialTypes['FederationScopes'];
      FederationPolicies: string extends PartialTypes['FederationPolicies']
        ? string
        : PartialTypes['FederationPolicies'];
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      shareable?: boolean;
      tag?: string[] | string;
      authenticated?: boolean;
      requiresScopes?: Types['FederationScopes'][][];
      policy?: Types['FederationPolicies'][][];
      cost?: number;
    }

    export interface InterfaceTypeOptions<Types extends SchemaTypes, Shape> {
      authenticated?: boolean;
      requiresScopes?: Types['FederationScopes'][][];
      policy?: Types['FederationPolicies'][][];
    }

    export interface ScalarTypeOptions<Types extends SchemaTypes> {
      authenticated?: boolean;
      requiresScopes?: Types['FederationScopes'][][];
      policy?: Types['FederationPolicies'][][];
      cost?: number;
    }

    export interface EnumTypeOptions<Types extends SchemaTypes> {
      authenticated?: boolean;
      requiresScopes?: Types['FederationScopes'][][];
      policy?: Types['FederationPolicies'][][];
      cost?: number;
    }

    export interface BaseTypeOptions<Types extends SchemaTypes = SchemaTypes> {
      inaccessible?: boolean;
    }

    export interface EnumValueConfig<Types extends SchemaTypes> {
      inaccessible?: boolean;
      cost?: number;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      shareable?: boolean;
      inaccessible?: boolean;
      override?: { from: string; label?: string };
      tag?: string[] | string;
      authenticated?: boolean;
      requiresScopes?: Types['FederationScopes'][][];
      policy?: Types['FederationPolicies'][][];
      cost?: number;
      listSize?: {
        assumedSize?: number;
        slicingArguments?: string[];
        sizedFields?: string[];
        requireOneSlicingArgument?: boolean;
      };
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>,
    > {
      inaccessible?: boolean;
      tag?: string[] | string;
      cost?: number;
    }
  }
}
