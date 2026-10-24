import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TokenStorageService } from './token-storage.service';
import {
  SignUpDto,
  SignInDto,
  GoogleLoginDto,
  GithubLoginDto,
  ChangePasswordDto,
} from './dto';
import {
  AuthResponse,
  AuthTokens,
  JwtAccessPayload,
  JwtRefreshPayload,
} from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessTtlSeconds = 15 * 60; // 15 minutes
  private readonly refreshTtlSeconds = 7 * 24 * 60 * 60; // 7 days

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenStorage: TokenStorageService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {
    this.accessSecret =
      this.configService.get<string>('JWT_ACCESS_SECRET') ||
      'quickgent-jwt-access-secret-production-grade';
    this.refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      'quickgent-jwt-refresh-secret-production-grade';
  }

  // --- Password Hashing (Argon2id) ---

  private async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
    });
  }

  private async verifyPassword(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false;
    }
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // --- Token Generation & Session Issuing ---

  private async issueTokens(
    userId: string,
    email: string,
    username: string,
    metadata: { ip?: string; userAgent?: string },
    existingSid?: string,
  ): Promise<AuthTokens> {
    const sessionId = existingSid || crypto.randomUUID();
    const accessJti = crypto.randomUUID();
    const refreshJti = crypto.randomUUID();

    const accessPayload: JwtAccessPayload = {
      sub: userId,
      email,
      username,
      jti: accessJti,
    };

    const refreshPayload: JwtRefreshPayload = {
      sub: userId,
      sid: sessionId,
      jti: refreshJti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.accessSecret,
        expiresIn: this.accessTtlSeconds,
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.refreshSecret,
        expiresIn: this.refreshTtlSeconds,
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);

    if (existingSid) {
      await this.tokenStorage.updateSessionToken(
        userId,
        sessionId,
        tokenHash,
        this.refreshTtlSeconds,
      );
    } else {
      await this.tokenStorage.createSession(
        userId,
        sessionId,
        tokenHash,
        metadata,
        this.refreshTtlSeconds,
      );
    }

    return {
      accessToken,
      refreshToken,
      expiresIn: this.accessTtlSeconds,
    };
  }

  // --- Sign Up (Credentials) ---

  async signUp(
    dto: SignUpDto,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    const normalizedEmail = dto.email.trim().toLowerCase();
    const normalizedUsername = dto.username.trim().toLowerCase();

    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: normalizedEmail }, { username: normalizedUsername }],
      },
    });

    if (existing) {
      if (existing.email === normalizedEmail) {
        throw new ConflictException('An account with this email already exists');
      }
      throw new ConflictException('This username is already taken');
    }

    const hashedPassword = await this.hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        authProvider: 'CREDENTIALS',
      },
    });

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      metadata,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  // --- Sign In (Credentials) ---

  async signIn(
    dto: SignInDto,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    const identifier = dto.emailOrUsername.trim().toLowerCase();

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    const isValid = await this.verifyPassword(user.password, dto.password);
    if (!isValid) {
      throw new UnauthorizedException('Invalid email/username or password');
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      metadata,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  // --- Sign In / Sign Up with Google ---

  async signInWithGoogle(
    dto: GoogleLoginDto,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    let googlePayload: {
      sub: string;
      email: string;
      email_verified?: string | boolean;
      name?: string;
      picture?: string;
    };

    try {
      const res = await fetch(
        `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(dto.idToken)}`,
      );
      if (!res.ok) {
        throw new Error('Google token verification failed');
      }
      googlePayload = await res.json();
    } catch (err) {
      this.logger.warn('Google token validation failed', err);
      throw new UnauthorizedException('Invalid Google ID token');
    }

    if (!googlePayload.email || !googlePayload.sub) {
      throw new UnauthorizedException('Google ID token missing email or sub');
    }

    const email = googlePayload.email.toLowerCase();
    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      let baseUsername = (
        googlePayload.name?.replace(/\s+/g, '_').toLowerCase() ||
        email.split('@')[0]
      ).replace(/[^a-z0-9_-]/g, '');

      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = `user_${crypto.randomBytes(3).toString('hex')}`;
      }

      let username = baseUsername;
      let counter = 1;
      while (await this.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${counter++}`;
      }

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          authProvider: 'GOOGLE',
          providerId: googlePayload.sub,
          avatarUrl: googlePayload.picture || null,
        },
      });
    } else {
      // Update avatar or providerId if missing
      if (!user.providerId || !user.avatarUrl) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            providerId: user.providerId || googlePayload.sub,
            avatarUrl: user.avatarUrl || googlePayload.picture || null,
          },
        });
      }
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      metadata,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  // --- Sign In / Sign Up with GitHub ---

  async signInWithGithub(
    dto: GithubLoginDto,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<AuthResponse> {
    let accessToken = dto.accessToken;

    if (!accessToken && dto.code) {
      const clientId = this.configService.get<string>('GITHUB_CLIENT_ID');
      const clientSecret = this.configService.get<string>('GITHUB_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new BadRequestException(
          'GitHub OAuth credentials are not configured on the server',
        );
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code: dto.code,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new UnauthorizedException('Failed to exchange GitHub authorization code');
      }
      accessToken = tokenData.access_token;
    }

    if (!accessToken) {
      throw new BadRequestException('Either code or accessToken must be provided');
    }

    // Fetch user profile from GitHub
    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'User-Agent': 'Quickgent-API',
      },
    });

    if (!userRes.ok) {
      throw new UnauthorizedException('Failed to fetch GitHub profile');
    }

    const ghUser = await userRes.json();
    let email = ghUser.email;

    // If email is private, fetch from emails endpoint
    if (!email) {
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'Quickgent-API',
        },
      });

      if (emailsRes.ok) {
        const emails: Array<{ email: string; primary: boolean; verified: boolean }> =
          await emailsRes.json();
        const primary = emails.find((e) => e.primary && e.verified) || emails[0];
        if (primary) email = primary.email;
      }
    }

    if (!email) {
      throw new BadRequestException('No verified email found for GitHub account');
    }

    email = email.toLowerCase();
    const providerId = ghUser.id.toString();

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      let baseUsername = (ghUser.login || `gh_${providerId}`)
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '');

      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = `user_${crypto.randomBytes(3).toString('hex')}`;
      }

      let username = baseUsername;
      let counter = 1;
      while (await this.prisma.user.findUnique({ where: { username } })) {
        username = `${baseUsername}_${counter++}`;
      }

      user = await this.prisma.user.create({
        data: {
          email,
          username,
          authProvider: 'GITHUB',
          providerId,
          avatarUrl: ghUser.avatar_url || null,
        },
      });
    } else {
      if (!user.providerId || !user.avatarUrl) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            providerId: user.providerId || providerId,
            avatarUrl: user.avatarUrl || ghUser.avatar_url || null,
          },
        });
      }
    }

    const tokens = await this.issueTokens(
      user.id,
      user.email,
      user.username,
      metadata,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        authProvider: user.authProvider,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
      },
      tokens,
    };
  }

  // --- Refresh Tokens (Rotation & Reuse Detection) ---

  async refreshTokens(
    refreshToken: string,
    metadata: { ip?: string; userAgent?: string },
  ): Promise<AuthTokens> {
    let payload: JwtRefreshPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtRefreshPayload>(refreshToken, {
        secret: this.refreshSecret,
      });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (!payload?.sub || !payload?.sid) {
      throw new UnauthorizedException('Malformed refresh token');
    }

    const session = await this.tokenStorage.getSession(payload.sub, payload.sid);
    if (!session) {
      throw new UnauthorizedException('Session expired or was revoked');
    }

    const incomingHash = this.hashToken(refreshToken);

    // --- REUSE DETECTION (Automatic Theft Defense) ---
    if (session.tokenHash !== incomingHash) {
      this.logger.warn(
        `Refresh token reuse detected for user ${payload.sub}, session ${payload.sid}! Invalidating compromised session.`,
      );
      // Immediately invalidate this compromised session family
      await this.tokenStorage.deleteSession(payload.sub, payload.sid);
      throw new UnauthorizedException(
        'Invalid refresh token: session has been terminated.',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    // Token Rotation: issue new access token & new refresh token for this session
    return this.issueTokens(
      user.id,
      user.email,
      user.username,
      metadata,
      payload.sid,
    );
  }

  // --- Logout (Single Device) ---

  async logout(
    userId: string,
    sessionId?: string,
    accessJti?: string,
    accessExp?: number,
  ): Promise<void> {
    if (sessionId) {
      await this.tokenStorage.deleteSession(userId, sessionId);
    }

    if (accessJti && accessExp) {
      const remainingSeconds = Math.max(
        0,
        accessExp - Math.floor(Date.now() / 1000),
      );
      if (remainingSeconds > 0) {
        await this.tokenStorage.blacklistAccessToken(accessJti, remainingSeconds);
      }
    }
  }

  // --- Logout All Devices (Global Revocation) ---

  async logoutAll(userId: string): Promise<void> {
    await this.tokenStorage.revokeAllUserTokens(userId);
  }

  // --- Change Password ---

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'This account was created via social login and does not have a password configured.',
      );
    }

    const isMatch = await this.verifyPassword(user.password, dto.oldPassword);
    if (!isMatch) {
      throw new UnauthorizedException('Current password does not match');
    }

    const newHashed = await this.hashPassword(dto.newPassword);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: newHashed },
    });

    // Revoke all existing sessions and tokens for security
    await this.tokenStorage.revokeAllUserTokens(userId);
  }

  // --- Get User Profile ---

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        authProvider: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }
}
