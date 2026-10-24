import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { JwtAccessPayload } from '../interfaces/jwt-payload.interface';
import { TokenStorageService } from '../token-storage.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly configService: ConfigService,
    private readonly tokenStorage: TokenStorageService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: Request) => {
          return req?.cookies?.['access_token'] ?? null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey:
        configService.get<string>('JWT_ACCESS_SECRET') ||
        'quickgent-jwt-access-secret-production-grade',
    });
  }

  async validate(payload: JwtAccessPayload) {
    if (!payload?.sub || !payload?.jti) {
      throw new UnauthorizedException('Malformed token payload');
    }

    // 1. Check if specific access token is blacklisted in Redis
    const isBlacklisted = await this.tokenStorage.isAccessTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 2. Check if user performed a global logout/revocation after this token was issued
    const revokedBefore = await this.tokenStorage.getUserRevokedBefore(payload.sub);
    if (revokedBefore && payload.iat && payload.iat < revokedBefore) {
      throw new UnauthorizedException('Session expired due to account security event');
    }

    return payload;
  }
}
