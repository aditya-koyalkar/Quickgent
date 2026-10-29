import { IsOptional, IsObject, IsString } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsOptional()
  @IsObject()
  inputs?: Record<string, any>;

  @IsOptional()
  @IsString()
  message?: string;

  @IsOptional()
  @IsString()
  user_message?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

export class LiveWorkflowChatDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  sessionId?: string;
}

