import { builder } from '../builder.ts';

import './race.ts';
import './location.ts';
import './item.ts';
import './character.ts';
import './faction.ts';
import './battle.ts';
import './book.ts';
import './user.ts';
import './search.ts';

export const schema = builder.toSchema();
