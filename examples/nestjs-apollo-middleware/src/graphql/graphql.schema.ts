import { schemaBuilder } from './schema.builder';

import '../features/comment/comment.schema';
import '../features/post/post.schema';
import '../features/user/user.schema';

export const graphqlSchema = schemaBuilder.toSchema();
