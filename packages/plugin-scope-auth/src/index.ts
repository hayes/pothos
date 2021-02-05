import SchemaBuilder, { BasePlugin, SchemaTypes } from '@giraphql/core';
import './global-types';

export * from './types';

export default class ScopeAuthPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  name: 'GiraphQLScopeAuth' = 'GiraphQLScopeAuth';

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>) {
    super(builder, 'GiraphQLScopeAuth');
  }
}

SchemaBuilder.registerPlugin('GiraphQLScopeAuth', ScopeAuthPlugin);
