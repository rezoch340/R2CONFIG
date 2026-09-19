import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateEnvironmentDto {
  @ApiProperty({ maxLength: 32, example: 'staging' })
  @IsString()
  @MinLength(1)
  @MaxLength(32)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: '环境名只能是小写字母、数字和连字符',
  })
  name: string;
}
