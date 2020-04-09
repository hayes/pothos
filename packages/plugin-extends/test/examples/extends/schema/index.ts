import './user';
import builder from '../builder';

builder.queryType({ shape: (t) => ({}) });
builder.mutationType({ shape: (t) => ({}) });
builder.subscriptionType({ shape: (t) => ({}) });

export default builder.toSchema();
