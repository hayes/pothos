import { builder } from './builder';

// Side-effect imports: each domain module registers its types and
// queries on the shared builder.
import './race';
import './character';

export const schema = builder.toSchema();
