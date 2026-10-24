import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { CreateProjectDto, UpdateProjectDto, GetProjectsQueryDto } from './dto';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Create a new project for the authenticated user
   */
  async create(userId: string, dto: CreateProjectDto) {
    const projectName = dto.name?.trim() || 'Untitled Project';

    const project = await this.prisma.project.create({
      data: {
        name: projectName,
        userId,
      },
    });

    // Invalidate cached project lists for this user
    await this.redisService.delByPattern(`projects:${userId}:*`);

    this.logger.log('Project created successfully', 'ProjectsService', {
      projectId: project.id,
      userId,
      name: project.name,
    });

    return project;
  }

  /**
   * Get paginated projects for the authenticated user with Redis caching
   */
  async findAll(userId: string, query: GetProjectsQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 10));
    const search = query.search?.trim();

    const cacheKey = `projects:${userId}:page=${page}:limit=${limit}:search=${search || ''}`;

    // 1. Try reading from Redis cache
    const cached = await this.redisService.get<{
      data: any[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>(cacheKey);

    if (cached) {
      this.logger.debug('Returning projects from Redis cache', 'ProjectsService', {
        userId,
        cacheKey,
      });
      return cached;
    }

    // 2. Fetch from Database
    const where: Prisma.ProjectWhereInput = {
      userId,
      isActive: true,
      ...(search
        ? {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          }
        : {}),
    };

    const [total, projects] = await Promise.all([
      this.prisma.project.count({ where }),
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { updatedAt: 'desc' },
        include: {
          _count: {
            select: {
              workflows: true,
              conversations: true,
            },
          },
        },
      }),
    ]);

    const result = {
      data: projects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    // 3. Cache result in Redis for 3 minutes (180s)
    await this.redisService.set(cacheKey, result, 180);

    return result;
  }

  /**
   * Get single project with workflows and conversations (with messages) and Redis caching
   */
  async findOne(userId: string, projectId: string) {
    const cacheKey = `project:${projectId}:${userId}`;

    // 1. Try reading from Redis cache
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      this.logger.debug('Returning single project from Redis cache', 'ProjectsService', {
        projectId,
        userId,
      });
      return cached;
    }

    // 2. Query database with workflows & conversations with messages
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
      include: {
        workflows: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          where: { isActive: true },
          orderBy: { updatedAt: 'desc' },
          include: {
            messages: {
              orderBy: { createdAt: 'asc' },
            },
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 3. Cache project in Redis for 5 minutes (300s)
    await this.redisService.set(cacheKey, project, 300);

    return project;
  }

  /**
   * Update project details (name, isActive) and invalidate cache
   */
  async update(userId: string, projectId: string, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(dto.name !== undefined && {
          name: dto.name.trim() || 'Untitled Project',
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    // Invalidate Redis caches: individual project cache and list caches
    await Promise.all([
      this.redisService.del(`project:${projectId}:${userId}`),
      this.redisService.delByPattern(`projects:${userId}:*`),
    ]);

    this.logger.log('Project updated successfully', 'ProjectsService', {
      projectId,
      userId,
    });

    return updated;
  }
}
