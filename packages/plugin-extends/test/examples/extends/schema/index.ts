import User from './user';
import builder from '../builder';

const Query = builder.createObjectType('Query', { shape: t => ({}) });

export default builder.toSchema([User, Query]);
