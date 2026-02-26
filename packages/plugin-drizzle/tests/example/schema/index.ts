import './comment';
import './post';
import './user';
import './query';
import './category';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DirectiveLocation,
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLNonNull,
  GraphQLString,
  printSchema,
} from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { builder } from '../builder';

builder.mutationType({});
builder.addScalarType('DateTime', DateTimeResolver);

export const schema = builder.toSchema({
  directives: [
    new GraphQLDirective({
      name: 'defer',
      description:
        'Directs the executor to defer this fragment when the `if` argument is true or undefined.',
      locations: [DirectiveLocation.FRAGMENT_SPREAD, DirectiveLocation.INLINE_FRAGMENT],
      args: {
        if: {
          type: new GraphQLNonNull(GraphQLBoolean),
          description: 'Deferred when true or undefined.',
          defaultValue: true,
        },
        label: {
          type: GraphQLString,
          description: 'Unique name',
        },
      },
    }),
  ],
});

writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));
