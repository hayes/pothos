import type { SchemaTypes } from '@pothos/core';
export declare function getFieldDescription<Types extends SchemaTypes>(model: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, fieldName: string, description?: string | false): string | undefined;
export declare function getModelDescription<Types extends SchemaTypes>(model: string, builder: PothosSchemaTypes.SchemaBuilder<Types>, description?: string | false): string | undefined;
