import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
  SignUpDto,
  SignInDto,
  GoogleLoginDto,
  GithubLoginDto,
  RefreshTokenDto,
  ChangePasswordDto,
} from './dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAccessPayload, AuthTokens } from './interfaces/jwt-payload.interface';
import { LoggerService } from '../logger/logger.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly logger: LoggerService,
  ) {}

  private extractMetadata(req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    return { ip, userAgent };
  }

  private setAuthCookies(res: Response, tokens: AuthTokens) {
    const isProduction = process.env.NODE_ENV === 'production';

    // Access Token Cookie (15 min)
    res.cookie('access_token', tokens.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });

    // Refresh Token Cookie (7 days)
    res.cookie('refresh_token', tokens.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth',
    });
  }

  private clearAuthCookies(res: Response) {
    const isProduction = process.env.NODE_ENV === 'production';
    res.clearCookie('access_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
    });
    res.clearCookie('refresh_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/auth',
    });
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('signup')
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body() dto: SignUpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    this.logger.log('Incoming signup request', 'AuthController', { email: dto.email, ip: metadata.ip });
    const result = await this.authService.signUp(dto, metadata);
    this.setAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() dto: SignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    this.logger.log('Incoming signin request', 'AuthController', { identifier: dto.emailOrUsername, ip: metadata.ip });
    const result = await this.authService.signIn(dto, metadata);
    this.setAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Post('oauth/google')
  @HttpCode(HttpStatus.OK)
  async signInWithGoogle(
    @Body() dto: GoogleLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    this.logger.log('Incoming Google OAuth request', 'AuthController', { ip: metadata.ip });
    const result = await this.authService.signInWithGoogle(dto, metadata);
    this.setAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Post('oauth/github')
  @HttpCode(HttpStatus.OK)
  async signInWithGithub(
    @Body() dto: GithubLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    this.logger.log('Incoming GitHub OAuth request', 'AuthController', { ip: metadata.ip });
    const result = await this.authService.signInWithGithub(dto, metadata);
    this.setAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const metadata = this.extractMetadata(req);
    this.logger.log('Incoming refresh token request', 'AuthController', { ip: metadata.ip });

    const refreshToken =
      dto.refreshToken || req.cookies?.['refresh_token'];

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const tokens = await this.authService.refreshTokens(refreshToken, metadata);
    this.setAuthCookies(res, tokens);
    return { tokens };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser() user: JwtAccessPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('User logout request', 'AuthController', { userId: user.sub });
    const sessionId = req.headers['x-session-id'] as string | undefined;
    await this.authService.logout(user.sub, sessionId, user.jti, user.exp);
    this.clearAuthCookies(res);
    return { message: 'Logged out successfully' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser('sub') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('User logout-all request', 'AuthController', { userId });
    await this.authService.logoutAll(userId);
    this.clearAuthCookies(res);
    return { message: 'Logged out from all devices successfully' };
  }

  @Get('me')
  async getMe(@CurrentUser('sub') userId: string) {
    this.logger.debug('Fetching current user profile', 'AuthController', { userId });
    return this.authService.getMe(userId);
  }

  @Patch('change-password')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('sub') userId: string,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.log('Password change request', 'AuthController', { userId });
    await this.authService.changePassword(userId, dto);
    this.clearAuthCookies(res);
    return {
      message: 'Password updated successfully. Please log in again with your new password.',
    };
  }
}
