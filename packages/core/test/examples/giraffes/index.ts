import builder from './builder';

import './objects';
import './interfaces';
import './unions';
import './enums';
import './scalars';
import './inputs';

builder.queryType({
  fields: (t) => ({
    giraffe: t.field({
      type: 'Giraffe',
      resolve: () => ({ name: 'James', heightInMeters: 5.2, birthday: new Date(2012, 11, 12) }),
    }),
  }),
});

const schema = builder.toSchema({});

export default schema;
