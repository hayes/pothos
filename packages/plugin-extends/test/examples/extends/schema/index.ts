import User from './user';
import builder from '../builder';

const Query = builder.createQueryType({ shape: t => ({}) });
const Mutation = builder.createMutationType({ shape: t => ({}) });
const Subscription = builder.createSubscriptionType({ shape: t => ({}) });

export default builder.toSchema([User, Query, Mutation, Subscription]);
