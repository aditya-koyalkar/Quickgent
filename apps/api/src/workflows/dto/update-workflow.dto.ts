import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateWorkflowDto {
  @IsOptional()
  json?: Record<string, any>;

  @IsOptional()
  graph?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Note cannot exceed 255 characters' })
  note?: string;
}
