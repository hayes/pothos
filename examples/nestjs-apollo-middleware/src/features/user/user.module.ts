import { Module } from '@nestjs/common';
import { UserRepository } from './user.repository';

@Module({
  providers: [UserRepository],
  exports: [UserRepository],
})
export class UserModule {}
