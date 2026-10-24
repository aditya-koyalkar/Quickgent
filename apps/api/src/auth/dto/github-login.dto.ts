import { IsOptional, IsString } from 'class-validator';

export class GithubLoginDto {
  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  accessToken?: string;
}
