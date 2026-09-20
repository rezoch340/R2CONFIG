import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAppDto {
  @ApiProperty({ maxLength: 64 })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name: string;

  @ApiProperty({ maxLength: 64, example: 'my-app' })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'slug 只能是小写字母、数字和连字符',
  })
  slug: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
