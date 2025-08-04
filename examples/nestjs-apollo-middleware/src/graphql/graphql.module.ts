import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { NextFunction, Request, Response } from 'express';
import type { GraphqlContext } from './graphql.context';
import { graphqlSchema } from './graphql.schema';

@Module({
  providers: [
    {
      provide: ApolloServer,
      useFactory: () => new ApolloServer({ schema: graphqlSchema }),
    },
  ],
})
export class GraphqlModule implements NestModule {
  constructor(
    readonly apolloServer: ApolloServer<GraphqlContext>,
    readonly moduleRef: ModuleRef,
  ) {}

  async configure(consumer: MiddlewareConsumer) {
    await this.apolloServer.start();

    // Workaround: GraphQL playground requires body to be present
    const noEmptyRequestBodyMiddleware = (req: Request, _res: Response, next: NextFunction) => {
      req.body ??= {};
      next();
    };

    const apolloExpressMiddleware = expressMiddleware<GraphqlContext>(this.apolloServer, {
      context: async () => ({
        get: (provider) => this.moduleRef.get(provider, { strict: false }),
      }),
    });

    consumer.apply(noEmptyRequestBodyMiddleware, apolloExpressMiddleware).forRoutes('graphql');
  }
}
