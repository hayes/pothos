import { SchemaTypes } from '@giraphql/core';

export interface AuthZOption<Types extends SchemaTypes> {
  rules: Types['AuthZRule'][];
}
