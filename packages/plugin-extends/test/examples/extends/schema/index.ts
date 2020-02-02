import User from './user';
import builder from '../builder';

const Query = builder.queryType({ shape: t => ({}) });
const Mutation = builder.mutationType({ shape: t => ({}) });
const Subscription = builder.subscriptionType({ shape: t => ({}) });

export default builder.toSchema([User, Query, Mutation, Subscription]);
