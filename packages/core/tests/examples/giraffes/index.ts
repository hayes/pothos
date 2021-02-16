import './objects';
import './interfaces';
import './unions';
import './enums';
import './scalars';
import './inputs';
import builder from './builder';

builder.queryType({});

const schema = builder.toSchema({});

export default schema;
