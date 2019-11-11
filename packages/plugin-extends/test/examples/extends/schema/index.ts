import User from './user';
import builder from '../builder';

const Query = builder.createObjectType('Query', { shape: t => ({}) });
const Mutation = builder.createObjectType('Mutation', { shape: t => ({}) });

export default builder.toSchema([User, Query, Mutation]);
