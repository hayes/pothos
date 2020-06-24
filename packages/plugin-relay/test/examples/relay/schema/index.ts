import './poll';
import builder from '../builder';

builder.queryType({ fields: (t) => ({}) });
builder.mutationType({ fields: (t) => ({}) });

export default builder.toSchema({});
