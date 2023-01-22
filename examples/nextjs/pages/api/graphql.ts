/** GraphQL API entrypoint */

import { createYoga } from 'graphql-yoga';
import type { NextApiRequest, NextApiResponse } from 'next';
import { schema } from '../../graphql/schema';

export const config = {
  api: {
    // Disable body parsing (required for file uploads)
    bodyParser: false,
  },
};

export default createYoga<{
  req: NextApiRequest;
  res: NextApiResponse;
}>({
  schema,
  graphqlEndpoint: '/api/graphql',
});
