import { ApolloGateway, IntrospectAndCompose } from '@apollo/gateway';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginInlineTraceDisabled } from '@apollo/server/plugin/disabled';

export function createGateway(configs: { name: string; url: string }[]) {
  return new ApolloServer({
    plugins: [ApolloServerPluginInlineTraceDisabled()],
    gateway: new ApolloGateway({
      supergraphSdl: new IntrospectAndCompose({
        subgraphs: configs,
      }),
    }),
  });
}
