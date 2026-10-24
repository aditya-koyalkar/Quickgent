import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class SignUpDto {
  @IsString()
  @IsNotEmpty({ message: 'Full name or username is required' })
  @Length(2, 50, { message: 'Name must be between 2 and 50 characters long' })
  username: string;

  @IsEmail({}, { message: 'Invalid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Password is required' })
  @Length(6, 64, { message: 'Password must be between 6 and 64 characters long' })
  password: string;
}
