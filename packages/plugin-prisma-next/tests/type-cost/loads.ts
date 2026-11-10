// `load` likewise checks its collection against the helpers' model alone.
import type { GraphQLResolveInfo } from 'graphql';
import { helpers, orm } from './relay-builder';

declare const request: [args: {}, context: {}, info: GraphQLResolveInfo];

export const pages = [
  helpers[0].load(orm.Model0, ...request),
  helpers[1].load(orm.Model1, ...request),
  helpers[2].load(orm.Model2, ...request),
  helpers[3].load(orm.Model3, ...request),
  helpers[4].load(orm.Model4, ...request),
  helpers[5].load(orm.Model5, ...request),
  helpers[6].load(orm.Model6, ...request),
  helpers[7].load(orm.Model7, ...request),
];
