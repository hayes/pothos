import { SchemaTypes } from '@pothos/core';

export interface AuthZOption<Types extends SchemaTypes> {
  rules: Types['AuthZRule'][];
}
