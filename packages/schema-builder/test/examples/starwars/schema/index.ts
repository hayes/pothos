import Character from './character';
import Droid from './droid';
import { Episode, MoreEpisodes } from './episode';
import Human from './human';
import Query from './query';

import builder from '../builder';

export default builder.toSchema([Character, Droid, Episode, Human, MoreEpisodes, Query]);
