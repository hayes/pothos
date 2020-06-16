import './user';
import builder from '../builder';

builder.queryType({ fields: (t) => ({}) });
builder.mutationType({ fields: (t) => ({}) });
builder.subscriptionType({ fields: (t) => ({}) });

export default builder.toSchema();
