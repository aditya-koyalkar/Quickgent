import { IsOptional, IsObject, IsString, MaxLength, MinLength } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsOptional()
  @IsObject()
  inputs?: Record<string, any>;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  message?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8000)
  user_message?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class LiveWorkflowChatDto {
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

