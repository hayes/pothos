import { SchemaTypes } from '@giraphql/core';
import MocksPlugin from '.';
import { ResolverMap } from './types';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLMocks: MocksPlugin<Types>;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      mocks?: ResolverMap<Types>;
    }
  }
}
