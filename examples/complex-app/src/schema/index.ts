import './game.ts';
import './player.ts';
import './point.ts';
import './team.ts';
import './user.ts';
import { builder } from '../builder.ts';

export const schema = builder.toSchema();
