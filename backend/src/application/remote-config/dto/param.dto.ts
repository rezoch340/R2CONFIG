import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PARAM_KEY_PATTERN, PARAM_SCOPES, PARAM_TYPES } from '../param-value';

export class CreateParamDto {
  @ApiProperty({ maxLength: 128, example: 'Features:BiometricLogin' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  @Matches(PARAM_KEY_PATTERN, {
    message: 'key 只能包含字母、数字、_ . -,分组用冒号分隔',
  })
  key: string;

  @ApiProperty({ enum: PARAM_TYPES })
  @IsIn(PARAM_TYPES)
  type: (typeof PARAM_TYPES)[number];

  @ApiPropertyOptional({ enum: PARAM_SCOPES, default: 'public' })
  @IsOptional()
  @IsIn(PARAM_SCOPES)
  scope?: (typeof PARAM_SCOPES)[number];

  @ApiProperty({
    description: '原文;boolean 传 "true"/"false",json 传序列化串',
  })
  @IsString()
  value: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class UpdateParamDto {
  @ApiPropertyOptional({ enum: PARAM_TYPES })
  @IsOptional()
  @IsIn(PARAM_TYPES)
  type?: (typeof PARAM_TYPES)[number];

  @ApiPropertyOptional({ enum: PARAM_SCOPES })
  @IsOptional()
  @IsIn(PARAM_SCOPES)
  scope?: (typeof PARAM_SCOPES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  value?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}

export class QueryParamsDto {
  @ApiPropertyOptional({ description: 'key 包含匹配' })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  search?: string;
}
