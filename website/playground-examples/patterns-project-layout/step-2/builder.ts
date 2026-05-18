import SchemaBuilder from '@pothos/core';

// Re-export a single builder so every type file shares it. Each domain
// module imports `builder` from here and never instantiates its own.
export const builder = new SchemaBuilder({});

builder.queryType({});
