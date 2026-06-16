import SchemaBuilder from '@pothos/core';

export interface Context {
  /** The id of the currently authenticated user, if any. */
  userId?: string;
}

export const builder = new SchemaBuilder<{
  Context: Context;
}>({});

builder.queryType({});
builder.mutationType({});
