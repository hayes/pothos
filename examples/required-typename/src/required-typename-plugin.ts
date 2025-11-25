import { ImplementableInterfaceRef, InterfaceRef, type SchemaTypes, UnionRef } from '@pothos/core';

// Add requiredTypename method to InterfaceRef
InterfaceRef.prototype.requiredTypename = function requiredTypename<
  Types extends SchemaTypes,
  T,
  P,
>(this: InterfaceRef<Types, T, P>) {
  // Return the same ref but with updated types to require __typename
  return this as unknown as InterfaceRef<Types, T & { __typename: string }, P>;
};

// Add requiredTypename method to ImplementableInterfaceRef
// (extends InterfaceRef, so it inherits the implementation, but we add it explicitly for clarity)
ImplementableInterfaceRef.prototype.requiredTypename = function requiredTypename<
  Types extends SchemaTypes,
  T,
  P,
>(this: ImplementableInterfaceRef<Types, T, P>) {
  // Return the same ref but with updated types to require __typename
  return this as unknown as ImplementableInterfaceRef<Types, T & { __typename: string }, P>;
};

// Add requiredTypename method to UnionRef
UnionRef.prototype.requiredTypename = function requiredTypename<Types extends SchemaTypes, T, P>(
  this: UnionRef<Types, T, P>,
) {
  // Return the same ref but with updated types to require __typename
  return this as unknown as UnionRef<Types, T & { __typename: string }, P>;
};

// Global type declarations to make the methods available in TypeScript
declare global {
  export namespace PothosSchemaTypes {
    export interface InterfaceRef<Types extends SchemaTypes, T, P = T> {
      /**
       * Returns the same interface ref but with __typename as a required field.
       * This ensures that any fields returning this interface will have __typename: string
       * as a required property in their resolved type.
       */
      requiredTypename(): InterfaceRef<Types, T & { __typename: string }, P>;
    }

    export interface ImplementableInterfaceRef<Types extends SchemaTypes, T, P = T> {
      /**
       * Returns the same interface ref but with __typename as a required field.
       * This ensures that any fields returning this interface will have __typename: string
       * as a required property in their resolved type.
       */
      requiredTypename(): ImplementableInterfaceRef<Types, T & { __typename: string }, P>;
    }

    export interface UnionRef<Types extends SchemaTypes, T, P = T> {
      /**
       * Returns the same union ref but with __typename as a required field.
       * This ensures that any fields returning this union will have __typename: string
       * as a required property in their resolved type.
       */
      requiredTypename(): UnionRef<Types, T & { __typename: string }, P>;
    }
  }
}
