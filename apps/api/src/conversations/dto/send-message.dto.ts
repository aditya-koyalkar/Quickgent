import { IsNotEmpty, IsString, IsOptional, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(10000)
  message: string;

  @IsOptional()
  currentWorkflow?: any;
}
