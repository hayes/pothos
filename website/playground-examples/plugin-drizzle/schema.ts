import { builder } from './builder';
import './types/user';
import './types/post';
import './types/viewer';
import './queries';

export const schema = builder.toSchema();
