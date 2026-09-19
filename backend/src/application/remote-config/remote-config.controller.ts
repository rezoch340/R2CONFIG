import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { ParseEntityIdPipe } from '../../common/pipes/parse-entity-id.pipe';
import { CreateAppDto } from './dto/create-app.dto';
import { CreateEnvironmentDto } from './dto/create-environment.dto';
import {
  CreateParamDto,
  QueryParamsDto,
  UpdateParamDto,
} from './dto/param.dto';
import { UpdateAppDto } from './dto/update-app.dto';
import { RemoteConfigService } from './remote-config.service';

// 后台管理接口;写操作由 system-audit-definition 的 config 条目自动记审计
@ApiTags('config')
@ApiBearerAuth('adminJwt')
@Controller('config')
export class RemoteConfigController {
  constructor(private readonly remoteConfigService: RemoteConfigService) {}

  // ----- 应用 -----

  @Get('apps')
  @RequirePermission('read', 'config')
  @ApiOperation({ summary: '应用列表' })
  listApps() {
    return this.remoteConfigService.listApps();
  }

  @Post('apps')
  @RequirePermission('create', 'config')
  @ApiOperation({ summary: '创建应用(自动带 dev/prod 环境)' })
  createApp(@Body() input: CreateAppDto) {
    return this.remoteConfigService.createApp(input);
  }

  @Patch('apps/:id')
  @RequirePermission('update', 'config')
  @ApiOperation({ summary: '改应用名' })
  updateApp(
    @Param('id', ParseEntityIdPipe) appId: number,
    @Body() input: UpdateAppDto,
  ) {
    return this.remoteConfigService.updateApp(appId, input.name);
  }

  @Delete('apps/:id')
  @RequirePermission('delete', 'config')
  @ApiOperation({ summary: '删除应用(级联删环境和参数)' })
  deleteApp(@Param('id', ParseEntityIdPipe) appId: number) {
    return this.remoteConfigService.deleteApp(appId);
  }

  @Post('apps/:id/rotate-key')
  @RequirePermission('update', 'config')
  @ApiOperation({ summary: '重置 server key' })
  rotateServerKey(@Param('id', ParseEntityIdPipe) appId: number) {
    return this.remoteConfigService.rotateServerKey(appId);
  }

  // ----- 环境 -----

  @Get('apps/:id/environments')
  @RequirePermission('read', 'config')
  @ApiOperation({ summary: '应用的环境列表' })
  listEnvironments(@Param('id', ParseEntityIdPipe) appId: number) {
    return this.remoteConfigService.listEnvironments(appId);
  }

  @Post('apps/:id/environments')
  @RequirePermission('create', 'config')
  @ApiOperation({ summary: '新增环境' })
  createEnvironment(
    @Param('id', ParseEntityIdPipe) appId: number,
    @Body() input: CreateEnvironmentDto,
  ) {
    return this.remoteConfigService.createEnvironment(appId, input);
  }

  @Delete('environments/:id')
  @RequirePermission('delete', 'config')
  @ApiOperation({ summary: '删除环境(级联删参数)' })
  deleteEnvironment(@Param('id', ParseEntityIdPipe) environmentId: number) {
    return this.remoteConfigService.deleteEnvironment(environmentId);
  }

  // ----- 参数 -----

  @Get('environments/:id/params')
  @RequirePermission('read', 'config')
  @ApiOperation({ summary: '环境下的参数列表' })
  listParams(
    @Param('id', ParseEntityIdPipe) environmentId: number,
    @Query() query: QueryParamsDto,
  ) {
    return this.remoteConfigService.listParams(environmentId, query.search);
  }

  @Post('environments/:id/params')
  @RequirePermission('create', 'config')
  @ApiOperation({ summary: '新增参数' })
  createParam(
    @Param('id', ParseEntityIdPipe) environmentId: number,
    @Body() input: CreateParamDto,
  ) {
    return this.remoteConfigService.createParam(environmentId, input);
  }

  @Post('environments/:id/params/import')
  @RequirePermission('create', 'config')
  @ApiOperation({ summary: '批量导入(JSON 对象,upsert)' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      example: { 'Features:BiometricLogin': true, 'App:MinVersion': '3.0.0' },
    },
  })
  importParams(
    @Param('id', ParseEntityIdPipe) environmentId: number,
    @Body() entries: Record<string, unknown>,
  ) {
    return this.remoteConfigService.importParams(environmentId, entries);
  }

  @Patch('params/:id')
  @RequirePermission('update', 'config')
  @ApiOperation({ summary: '修改参数' })
  updateParam(
    @Param('id', ParseEntityIdPipe) paramId: number,
    @Body() input: UpdateParamDto,
  ) {
    return this.remoteConfigService.updateParam(paramId, input);
  }

  @Delete('params/:id')
  @RequirePermission('delete', 'config')
  @ApiOperation({ summary: '删除参数' })
  deleteParam(@Param('id', ParseEntityIdPipe) paramId: number) {
    return this.remoteConfigService.deleteParam(paramId);
  }
}
