import { builder } from './builder';
import './types/user';
import './types/post';
import './queries';

export const schema = builder.toSchema();
