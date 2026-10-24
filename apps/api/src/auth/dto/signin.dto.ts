import { IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
  @IsString()
  @IsNotEmpty({ message: 'Email or username is required' })
  emailOrUsername: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  password: string;
}
