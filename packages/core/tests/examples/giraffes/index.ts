import builder from './builder';

import './objects';
import './interfaces';
import './unions';
import './enums';
import './scalars';
import './inputs';

builder.queryType({});

const schema = builder.toSchema({});

export default schema;
