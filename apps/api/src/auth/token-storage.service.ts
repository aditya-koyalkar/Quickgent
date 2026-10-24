import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface UserSessionData {
  tokenHash: string;
  ip?: string;
  userAgent?: string;
  createdAt: number;
}

@Injectable()
export class TokenStorageService {
  constructor(private readonly redis: RedisService) {}

  // --- Access Token Blacklist ---

  async blacklistAccessToken(jti: string, ttlSeconds: number): Promise<void> {
    if (ttlSeconds <= 0) return;
    await this.redis.set(`bl:at:${jti}`, '1', ttlSeconds);
  }

  async isAccessTokenBlacklisted(jti: string): Promise<boolean> {
    return this.redis.exists(`bl:at:${jti}`);
  }

  // --- Global User Revocation ---

  async revokeAllUserTokens(userId: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    // 7 days TTL (matches max refresh token lifespan)
    await this.redis.set(`user:revoked_before:${userId}`, now.toString(), 7 * 24 * 60 * 60);
    await this.deleteAllUserSessions(userId);
  }

  async getUserRevokedBefore(userId: string): Promise<number | null> {
    const val = await this.redis.get<string>(`user:revoked_before:${userId}`);
    return val ? parseInt(val, 10) : null;
  }

  // --- Refresh Token Sessions ---

  async createSession(
    userId: string,
    sessionId: string,
    tokenHash: string,
    metadata: { ip?: string; userAgent?: string },
    ttlSeconds: number,
  ): Promise<void> {
    const sessionData: UserSessionData = {
      tokenHash,
      ip: metadata.ip,
      userAgent: metadata.userAgent,
      createdAt: Date.now(),
    };
    await this.redis.set(`session:${userId}:${sessionId}`, sessionData, ttlSeconds);
  }

  async getSession(userId: string, sessionId: string): Promise<UserSessionData | null> {
    return this.redis.get<UserSessionData>(`session:${userId}:${sessionId}`);
  }

  async updateSessionToken(
    userId: string,
    sessionId: string,
    newTokenHash: string,
    ttlSeconds: number,
  ): Promise<void> {
    const session = await this.getSession(userId, sessionId);
    if (!session) return;
    session.tokenHash = newTokenHash;
    await this.redis.set(`session:${userId}:${sessionId}`, session, ttlSeconds);
  }

  async deleteSession(userId: string, sessionId: string): Promise<void> {
    await this.redis.del(`session:${userId}:${sessionId}`);
  }

  async deleteAllUserSessions(userId: string): Promise<void> {
    await this.redis.delByPattern(`session:${userId}:*`);
  }
}
