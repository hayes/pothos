/* eslint-disable @typescript-eslint/no-unused-vars */
import { BasePlugin } from '@giraphql/core';
import './global-types';

export default class ExtendsPlugin<Types extends GiraphQLSchemaTypes.TypeInfo>
  implements BasePlugin<Types> {
  visitObjectType() {}
}
