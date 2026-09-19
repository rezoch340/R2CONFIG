import { Controller, Get, Headers, Param, Res } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { RemoteConfigService } from './remote-config.service';

// app 端拉取接口:无需登录;public 参数裸拉,private 参数要 X-Api-Key
@ApiTags('config-public')
@Controller('v1/config')
export class RemoteConfigPublicController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  @Get(':slug/:env')
  @Public()
  @ApiOperation({ summary: '拉取某应用某环境的配置' })
  @ApiHeader({
    name: 'X-Api-Key',
    required: false,
    description: '应用的 server key;带上才返回 private 参数',
  })
  async fetch(
    @Param('slug') slug: string,
    @Param('env') environmentName: string,
    @Headers('x-api-key') serverKey: string | undefined,
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res() response: Response,
  ) {
    const { etag, load } = await this.remoteConfigService.resolvePublicConfig(
      slug,
      environmentName,
      serverKey,
    );
    response.setHeader('ETag', etag);
    response.setHeader('Cache-Control', 'no-cache');
    if (ifNoneMatch === etag) {
      response.status(304).end();
      return;
    }
    response.json(await load());
  }
}
