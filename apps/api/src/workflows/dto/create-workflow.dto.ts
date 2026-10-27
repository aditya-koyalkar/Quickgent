import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty({ message: 'Version is required (e.g. 1.0.0)' })
  @MaxLength(20, { message: 'Version cannot exceed 20 characters' })
  version: string;

  @IsNotEmpty({ message: 'Workflow JSON definition is required' })
  json: Record<string, any>;

  @IsOptional()
  graph?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Note cannot exceed 255 characters' })
  note?: string;
}
