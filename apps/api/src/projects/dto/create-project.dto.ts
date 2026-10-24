import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Project name cannot exceed 150 characters' })
  name?: string;
}
