// @ts-nocheck
import { SchemaTypes } from '../core/index.ts';
export interface AuthZOption<Types extends SchemaTypes> {
    rules: Types["AuthZRule"][];
}
