import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Project name cannot exceed 150 characters' })
  name?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
