import { Module } from '@nestjs/common';
import { CommentModule } from './comment/comment.module';
import { PostModule } from './post/post.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [CommentModule, PostModule, UserModule],
})
export class FeaturesModule {}
