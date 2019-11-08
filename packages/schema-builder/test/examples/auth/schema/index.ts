import Query from './query';
import Mutation from './mutation';
import User from './user';
import builder from '../builder';

export default builder.toSchema([Query, Mutation, User]);
