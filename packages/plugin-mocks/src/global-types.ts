import { SchemaTypes } from '@pothos/core';
import { ResolverMap } from './types';

import type { MocksPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      mocks: MocksPlugin<Types>;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      mocks?: ResolverMap<Types>;
    }
  }
}
