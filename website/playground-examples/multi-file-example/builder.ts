import SchemaBuilder from '@pothos/core';
import type { Post, User } from './types';

// Create the schema builder
export const builder = new SchemaBuilder<{
  Objects: {
    User: User;
    Post: Post;
  };
}>({});
