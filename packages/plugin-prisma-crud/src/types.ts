// Type map: https://github.com/prisma/prisma/blob/main/packages/client/src/runtime/utils/common.ts#L63

import { SchemaTypes } from '@pothos/core';

export interface PrismaCrudTypes {
  ScalarFilters: {};
}

export type GetPrismaCrud<Types extends SchemaTypes> =
  Types['PrismaCrudTypes'] extends PrismaCrudTypes ? Types['PrismaCrudTypes'] : never;

export type ScalarFilterName<Types extends SchemaTypes> =
  keyof GetPrismaCrud<Types>['ScalarFilters'];
