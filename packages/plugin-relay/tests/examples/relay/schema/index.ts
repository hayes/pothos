import builder from '../builder';
import './poll';
import './numbers';

builder.queryType({ fields: (t) => ({}) });
builder.mutationType({ fields: (t) => ({}) });

export default builder.toSchema({});
