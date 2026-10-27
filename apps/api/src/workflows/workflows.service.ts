import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  GetWorkflowsQueryDto,
} from './dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
  ) {}

  /**
   * Helper to verify project exists and belongs to the user
   */
  private async verifyProjectAccess(userId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
        isActive: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  /**
   * Invalidate all relevant Redis cache keys for a project
   */
  private async invalidateCaches(projectId: string, userId: string) {
    await Promise.all([
      this.redisService.del(`project:${projectId}:${userId}`),
      this.redisService.delByPattern(`projects:${userId}:*`),
      this.redisService.delByPattern(`workflows:${projectId}:*`),
    ]);
  }

  /**
   * Validates that a workflow JSON payload is structurally valid and non-empty.
   */
  private validateWorkflowJson(json: any) {
    if (!json || typeof json !== 'object' || Array.isArray(json)) {
      throw new BadRequestException(
        'Workflow JSON must be a valid non-empty object.',
      );
    }

    const nodes = json.nodes;
    const edges = json.edges;

    if (!Array.isArray(nodes)) {
      throw new BadRequestException(
        'Invalid workflow JSON: "nodes" must be an array.',
      );
    }

    if (!Array.isArray(edges)) {
      throw new BadRequestException(
        'Invalid workflow JSON: "edges" must be an array.',
      );
    }

    if (nodes.length === 0) {
      throw new BadRequestException(
        'Invalid workflow JSON: workflow must contain at least one node.',
      );
    }

    const nodeIds = new Set<string>();
    for (const node of nodes) {
      if (!node || typeof node !== 'object') {
        throw new BadRequestException(
          'Invalid workflow JSON: each node must be an object.',
        );
      }
      if (!node.id || typeof node.id !== 'string') {
        throw new BadRequestException(
          'Invalid workflow JSON: each node must have a valid string "id".',
        );
      }
      if (!node.type || typeof node.type !== 'string') {
        throw new BadRequestException(
          `Invalid workflow JSON: node "${node.id}" must have a valid "type".`,
        );
      }
      if (nodeIds.has(node.id)) {
        throw new BadRequestException(
          `Invalid workflow JSON: duplicate node id "${node.id}".`,
        );
      }
      nodeIds.add(node.id);
    }

    for (const edge of edges) {
      if (!edge || typeof edge !== 'object') {
        throw new BadRequestException(
          'Invalid workflow JSON: each edge must be an object.',
        );
      }
      if (
        !edge.source ||
        typeof edge.source !== 'string' ||
        !nodeIds.has(edge.source)
      ) {
        throw new BadRequestException(
          `Invalid workflow JSON: edge "${edge.id || 'unknown'}" references invalid source node "${edge.source}".`,
        );
      }
      if (
        !edge.target ||
        typeof edge.target !== 'string' ||
        !nodeIds.has(edge.target)
      ) {
        throw new BadRequestException(
          `Invalid workflow JSON: edge "${edge.id || 'unknown'}" references invalid target node "${edge.target}".`,
        );
      }
    }
  }

  /**
   * Create a new workflow version for a project.
   * Every workflow JSON saved is strictly validated.
   */
  async create(userId: string, projectId: string, dto: CreateWorkflowDto) {
    await this.verifyProjectAccess(userId, projectId);

    const version = dto.version.trim();

    // Check for duplicate version within this project
    const existing = await this.prisma.workflow.findUnique({
      where: {
        projectId_version: {
          projectId,
          version,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        `Workflow version "${version}" already exists for this project.`,
      );
    }

    const rawGraph = dto.json ?? dto.graph;
    this.validateWorkflowJson(rawGraph);

    const graph = rawGraph as Prisma.InputJsonValue;
    const note = dto.note?.trim() || null;

    const workflow = await this.prisma.workflow.create({
      data: {
        projectId,
        version,
        isLive: false,
        note,
        graph,
      },
    });

    await this.invalidateCaches(projectId, userId);

    this.logger.log('Workflow created successfully', 'WorkflowsService', {
      workflowId: workflow.id,
      projectId,
      version: workflow.version,
      isLive: workflow.isLive,
    });

    return workflow;
  }

  /**
   * List all workflow versions for a project
   */
  async findAll(
    userId: string,
    projectId: string,
    query?: GetWorkflowsQueryDto,
  ) {
    await this.verifyProjectAccess(userId, projectId);

    const cacheKey = `workflows:${projectId}:isLive=${query?.isLive !== undefined ? query.isLive : 'all'}`;
    const cached = await this.redisService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const workflows = await this.prisma.workflow.findMany({
      where: {
        projectId,
        ...(query?.isLive !== undefined ? { isLive: query.isLive } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    await this.redisService.set(cacheKey, workflows, 180);

    return workflows;
  }

  /**
   * Get single workflow by version tag or ID
   */
  async findOne(userId: string, projectId: string, versionOrId: string) {
    await this.verifyProjectAccess(userId, projectId);

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        projectId,
        OR: [{ version: versionOrId }, { id: versionOrId }],
      },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Workflow version "${versionOrId}" not found for this project.`,
      );
    }

    return workflow;
  }

  /**
   * Update an existing workflow version (graph JSON or note).
   * Live versions cannot be modified directly (must publish a new version).
   */
  async update(
    userId: string,
    projectId: string,
    versionOrId: string,
    dto: UpdateWorkflowDto,
  ) {
    await this.verifyProjectAccess(userId, projectId);

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        projectId,
        OR: [{ version: versionOrId }, { id: versionOrId }],
      },
    });

    if (!workflow) {
      throw new NotFoundException(
        `Workflow version "${versionOrId}" not found for this project.`,
      );
    }

    if (workflow.isLive) {
      throw new BadRequestException(
        'Cannot directly edit a LIVE workflow. Please publish changes as a new version.',
      );
    }

    const data: Prisma.WorkflowUpdateInput = {};

    if (dto.json !== undefined || dto.graph !== undefined) {
      const rawGraph = dto.json ?? dto.graph;
      this.validateWorkflowJson(rawGraph);
      data.graph = rawGraph as Prisma.InputJsonValue;
    }

    if (dto.note !== undefined) {
      data.note = dto.note?.trim() || null;
    }

    const updated = await this.prisma.workflow.update({
      where: { id: workflow.id },
      data,
    });

    await this.invalidateCaches(projectId, userId);

    this.logger.log('Workflow updated successfully', 'WorkflowsService', {
      workflowId: updated.id,
      projectId,
      version: updated.version,
    });

    return updated;
  }

  /**
   * Promote a specific workflow version to LIVE (isLive = 1/true).
   * Atomically resets previously LIVE workflows in this project to isLive = 0/false.
   */
  async makeLive(userId: string, projectId: string, versionOrId: string) {
    await this.verifyProjectAccess(userId, projectId);

    const target = await this.prisma.workflow.findFirst({
      where: {
        projectId,
        OR: [{ version: versionOrId }, { id: versionOrId }],
      },
    });

    if (!target) {
      throw new NotFoundException(
        `Workflow version "${versionOrId}" not found for this project.`,
      );
    }

    // Validate that graph is valid before making live
    this.validateWorkflowJson(target.graph);

    // Interactive transaction ensures atomic transition:
    // 1. Demote any current LIVE versions in this project to isLive = false
    // 2. Set target version to isLive = true
    const liveWorkflow = await this.prisma.$transaction(async (tx) => {
      await tx.workflow.updateMany({
        where: {
          projectId,
          isLive: true,
          id: { not: target.id },
        },
        data: {
          isLive: false,
        },
      });

      return tx.workflow.update({
        where: { id: target.id },
        data: {
          isLive: true,
        },
      });
    });

    await this.invalidateCaches(projectId, userId);

    this.logger.log('Workflow version promoted to LIVE', 'WorkflowsService', {
      workflowId: liveWorkflow.id,
      projectId,
      version: liveWorkflow.version,
      isLive: liveWorkflow.isLive,
    });

    return liveWorkflow;
  }

  /**
   * Delete a workflow version
   */
  async delete(userId: string, projectId: string, versionOrId: string) {
    await this.verifyProjectAccess(userId, projectId);

    const target = await this.prisma.workflow.findFirst({
      where: {
        projectId,
        OR: [{ version: versionOrId }, { id: versionOrId }],
      },
    });

    if (!target) {
      throw new NotFoundException(
        `Workflow version "${versionOrId}" not found for this project.`,
      );
    }

    if (target.isLive) {
      throw new BadRequestException(
        'Cannot delete the currently LIVE workflow version. Make another version LIVE first.',
      );
    }

    await this.prisma.workflow.delete({
      where: { id: target.id },
    });

    await this.invalidateCaches(projectId, userId);

    this.logger.log('Workflow version deleted', 'WorkflowsService', {
      workflowId: target.id,
      projectId,
      version: target.version,
    });

    return {
      success: true,
      message: `Workflow version ${target.version} has been deleted.`,
    };
  }
}
