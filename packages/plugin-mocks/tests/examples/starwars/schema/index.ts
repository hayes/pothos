import './character';
import './droid';
import './episode';
import './human';
import './query';
import { builder } from '../builder';

export const schema = builder.toSchema();
