import { Module } from '@nestjs/common';
import { RemoteConfigPublicController } from './remote-config-public.controller';
import { RemoteConfigController } from './remote-config.controller';
import { RemoteConfigService } from './remote-config.service';

@Module({
  controllers: [RemoteConfigController, RemoteConfigPublicController],
  providers: [RemoteConfigService],
})
export class RemoteConfigModule {}
