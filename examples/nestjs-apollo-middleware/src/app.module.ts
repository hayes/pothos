import { Module } from '@nestjs/common';
import { FeaturesModule } from './features/features.module';
import { GraphqlModule } from './graphql/graphql.module';

@Module({
  imports: [FeaturesModule, GraphqlModule],
})
export class AppModule {}
