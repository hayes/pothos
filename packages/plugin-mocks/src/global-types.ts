import { ObjectParam, Resolver, SchemaTypes, ShapeFromTypeParam } from '@pothos/core';
import { Mock, ResolverMap } from './types';
import { MocksPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      mocks: MocksPlugin<Types>;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      mocks?: ResolverMap<Types>;
      typeMocks?: Mock<Types>[];
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      createObjectMock: <
        Shape extends NameOrRef extends ObjectParam<Types>
          ? ShapeFromTypeParam<Types, NameOrRef, false>
          : object,
        NameOrRef extends ObjectParam<Types> | string,
      >(
        nameOrRef: NameOrRef,
        resolver: Resolver<unknown, unknown, Types['Context'], Partial<Shape>>,
      ) => Mock<Types>;
    }
  }
}
