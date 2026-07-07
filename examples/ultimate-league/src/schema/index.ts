import { builder } from '../builder.ts';

import './user.ts';
import './team.ts';
import './player.ts';
import './game.ts';
import './point.ts';

export const schema = builder.toSchema();
