import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  GatewayTimeoutException,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import { getEngineAuthHeaders } from '../common/engine-auth';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  GetWorkflowsQueryDto,
  ExecuteWorkflowDto,
  LiveWorkflowChatDto,
} from './dto';

@Injectable()
export class WorkflowsService {
  private readonly engineUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.engineUrl =
      this.configService.get<string>('ENGINE_URL') ||
      process.env.ENGINE_URL ||
      'http://engine:8000';
  }

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
   * Get currently active LIVE workflow for a project
   */
  async findLive(projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, isActive: true },
      select: { id: true, name: true, userId: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const workflow = await this.prisma.workflow.findFirst({
      where: {
        projectId,
        isLive: true,
      },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    if (!workflow) {
      throw new NotFoundException(
        'No active LIVE workflow version found for this project.',
      );
    }

    return workflow;
  }

  /**
   * Get single workflow by version tag or ID
   */
  async findOne(userId: string, projectId: string, versionOrId: string) {
    if (versionOrId === 'live') {
      return this.findLive(projectId);
    }

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

  /**
   * Execute live workflow graph using Python Engine
   */
  async executeLive(projectId: string, dto: ExecuteWorkflowDto) {
    const liveWorkflow = await this.findLive(projectId);

    // Normalize inputs
    const inputs: Record<string, any> = { ...(dto.inputs || {}) };
    if (dto.user_message) inputs.user_message = dto.user_message;
    if (dto.message && !inputs.user_message) inputs.user_message = dto.message;

    const engineUrl = `${this.engineUrl}/workflow/execute`;
    this.logger.log(
      `Executing live workflow v${liveWorkflow.version} for project ${projectId}`,
      'WorkflowsService',
    );

    let engineResult: any;
    try {
      const resp = await fetch(engineUrl, {
        method: 'POST',
        headers: getEngineAuthHeaders('POST', '/workflow/execute') as any,
        body: JSON.stringify({
          workflow: liveWorkflow.graph,
          workflow_id: liveWorkflow.id,
          project_id: projectId,
          inputs,
          session_id: dto.sessionId,
        }),
        signal: AbortSignal.timeout(90000), // 90s inter-service execution timeout
      });

      if (!resp.ok) {
        let errDetail = `Engine error (status ${resp.status})`;
        try {
          const errJson = await resp.json();
          errDetail = errJson.detail || errDetail;
        } catch { }
        throw new BadRequestException(errDetail);
      }

      engineResult = await resp.json();
    } catch (err: any) {
      this.logger.error(
        `Live workflow execution failed: ${err.message}`,
        err.stack,
        'WorkflowsService',
      );
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new GatewayTimeoutException(
          'Workflow execution timed out after 90 seconds. Please optimize your workflow or reduce step latency.',
        );
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(err.message || 'Workflow execution failed');
    }

    // Persist execution audit log in database
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: liveWorkflow.id,
        projectId,
        status: engineResult.status || 'COMPLETED',
        inputs,
        outputs: engineResult.outputs || {},
        state: engineResult.state || {},
        trace: engineResult.step_traces || [],
        durationMs: Math.round(engineResult.total_duration_ms || 0),
        totalTokens: engineResult.total_tokens || 0,
      },
    });

    return {
      executionId: execution.id,
      workflowVersion: liveWorkflow.version,
      status: engineResult.status,
      response: engineResult.response_text,
      outputs: engineResult.outputs,
      state: engineResult.state,
      stepTraces: engineResult.step_traces,
      totalDurationMs: engineResult.total_duration_ms,
      totalTokens: engineResult.total_tokens,
    };
  }

  /**
   * Resolve a workflow either by direct workflow ID or by project ID (finding its live version)
   */
  async findLiveById(idOrWorkflowId: string) {
    // 1. Try finding by direct workflow ID
    let workflow = await this.prisma.workflow.findUnique({
      where: { id: idOrWorkflowId },
      include: {
        project: {
          select: { id: true, name: true },
        },
      },
    });

    // 2. Fallback: try finding live workflow by projectId
    if (!workflow) {
      workflow = await this.prisma.workflow.findFirst({
        where: { projectId: idOrWorkflowId, isLive: true },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });
    }

    if (!workflow) {
      throw new NotFoundException(
        `Workflow "${idOrWorkflowId}" not found or not published.`,
      );
    }

    return workflow;
  }

  /**
   * Multi-turn chat using dynamic workflow ID or project ID
   */
  async chatLiveById(
    idOrWorkflowId: string,
    dto: LiveWorkflowChatDto,
    userId?: string,
  ) {
    const workflow = await this.findLiveById(idOrWorkflowId);
    return this.chatLive(workflow.projectId, dto, userId);
  }

  /**
   * Multi-turn chat using dynamic workflow ID or project ID with SSE streaming
   */
  async chatLiveStreamById(
    idOrWorkflowId: string,
    dto: LiveWorkflowChatDto,
    res: Response,
    userId?: string,
  ) {
    const workflow = await this.findLiveById(idOrWorkflowId);
    return this.chatLiveStream(workflow.projectId, dto, res, userId);
  }

  /**
   * Execute live workflow using dynamic workflow ID or project ID
   */
  async executeLiveById(
    idOrWorkflowId: string,
    dto: ExecuteWorkflowDto,
  ) {
    const workflow = await this.findLiveById(idOrWorkflowId);
    return this.executeLive(workflow.projectId, dto);
  }

  /**
   * Multi-turn chat with live workflow agent
   */
  async chatLive(
    projectId: string,
    dto: LiveWorkflowChatDto,
    _userId?: string,
  ) {
    const liveWorkflow = await this.findLive(projectId);
    const userText = dto.message?.trim();
    if (!userText) {
      throw new BadRequestException('Message cannot be empty');
    }

    // Find or create live conversation using frontend-generated session ID or conversationId
    let conversation: any;
    const targetSessionId = dto.sessionId || dto.conversationId;
    if (targetSessionId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: targetSessionId, projectId, isActive: true },
      });
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          id: targetSessionId || undefined,
          projectId,
          workflowId: liveWorkflow.id,
          workflowVersion: liveWorkflow.version,
          isLive: true,
          name: userText.length > 35 ? `${userText.slice(0, 35)}…` : userText,
        },
      });
    }

    // Store user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: { text: userText },
        metadata: {
          workflowId: liveWorkflow.id,
          workflowVersion: liveWorkflow.version,
          isLive: true,
        },
      },
    });

    // Fetch up to 20 past conversation messages (excluding current message)
    const pastMessages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        id: { not: userMessage.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const conversationHistory = pastMessages.reverse().map((m) => {
      let contentText = '';
      if (typeof m.content === 'string') {
        contentText = m.content;
      } else if (m.content && typeof m.content === 'object') {
        contentText =
          (m.content as any).text ||
          (m.content as any).message ||
          JSON.stringify(m.content);
      }
      return {
        role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: contentText,
      };
    });

    // Execute workflow in engine with inputs and session_id (API provides past history)
    const engineUrl = `${this.engineUrl}/workflow/execute`;
    let engineResult: any;
    try {
      const resp = await fetch(engineUrl, {
        method: 'POST',
        headers: getEngineAuthHeaders('POST', '/workflow/execute') as any,
        body: JSON.stringify({
          workflow: liveWorkflow.graph,
          workflow_id: liveWorkflow.id,
          project_id: projectId,
          inputs: { user_message: userText },
          session_id: conversation.id,
          conversation_history: conversationHistory,
        }),
        signal: AbortSignal.timeout(90000), // 90s inter-service execution timeout
      });

      if (!resp.ok) {
        let errDetail = `Engine error (${resp.status})`;
        try {
          const errJson = await resp.json();
          errDetail = errJson.detail || errDetail;
        } catch { }
        throw new BadRequestException(errDetail);
      }

      engineResult = await resp.json();
    } catch (err: any) {
      this.logger.error(
        `Live chat execution failed: ${err.message}`,
        err.stack,
        'WorkflowsService',
      );
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
        throw new GatewayTimeoutException(
          'Agent response timed out after 90 seconds. The engine or model took too long to complete.',
        );
      }
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException(
        err.message || 'Agent failed to run workflow',
      );
    }

    // Save assistant message
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'ASSISTANT',
        content: {
          text: engineResult.response_text,
          outputs: engineResult.outputs,
        },
        metadata: {
          workflowId: liveWorkflow.id,
          workflowVersion: liveWorkflow.version,
          executionId: engineResult.execution_id,
          stepTraces: engineResult.step_traces,
          durationMs: engineResult.total_duration_ms,
        },
        model: 'gemini-workflow-agent',
      },
    });

    // Persist or update workflow execution record (upsert handles both engine-persisted and API fallback)
    const execution = await this.prisma.workflowExecution.upsert({
      where: { id: engineResult.execution_id || 'unknown-id' },
      update: {
        status: engineResult.status || 'COMPLETED',
        outputs: engineResult.outputs || {},
        state: engineResult.state || {},
        trace: engineResult.step_traces || [],
        durationMs: Math.round(engineResult.total_duration_ms || 0),
        totalTokens: engineResult.total_tokens || 0,
      },
      create: {
        id: engineResult.execution_id || undefined,
        workflowId: liveWorkflow.id,
        projectId,
        status: engineResult.status || 'COMPLETED',
        inputs: { user_message: userText },
        outputs: engineResult.outputs || {},
        state: engineResult.state || {},
        trace: engineResult.step_traces || [],
        durationMs: Math.round(engineResult.total_duration_ms || 0),
        totalTokens: engineResult.total_tokens || 0,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });

    return {
      conversationId: conversation.id,
      sessionId: conversation.id,
      workflowVersion: conversation.workflowVersion || liveWorkflow.version,
      userMessage,
      assistantMessage,
      reply: engineResult.response_text,
      executionId: execution.id,
      stepTraces: engineResult.step_traces,
      totalDurationMs: engineResult.total_duration_ms,
      totalTokens: engineResult.total_tokens,
      workflow: {
        id: liveWorkflow.id,
        version: conversation.workflowVersion || liveWorkflow.version,
        note: liveWorkflow.note,
        project: liveWorkflow.project,
      },
    };
  }

  /**
   * Multi-turn chat with live workflow agent streaming real-time tokens via SSE
   */
  async chatLiveStream(
    projectId: string,
    dto: LiveWorkflowChatDto,
    res: Response,
    _userId?: string,
  ) {
    const userText = dto.message?.trim();
    if (!userText) {
      res.status(400).json({ message: 'Message cannot be empty' });
      return;
    }

    let liveWorkflow: any;
    try {
      liveWorkflow = await this.findLive(projectId);
    } catch (err: any) {
      res.status(404).json({ message: err.message || 'Live workflow not found' });
      return;
    }

    // Set SSE HTTP response headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    // Find or create conversation
    let conversation: any;
    const targetSessionId = dto.sessionId || dto.conversationId;
    if (targetSessionId) {
      conversation = await this.prisma.conversation.findFirst({
        where: { id: targetSessionId, projectId, isActive: true },
      });
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          id: targetSessionId || undefined,
          projectId,
          workflowId: liveWorkflow.id,
          workflowVersion: liveWorkflow.version,
          isLive: true,
          name: userText.length > 35 ? `${userText.slice(0, 35)}…` : userText,
        },
      });
    }

    // Store user message
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'USER',
        content: { text: userText },
        metadata: {
          workflowId: liveWorkflow.id,
          workflowVersion: liveWorkflow.version,
          isLive: true,
        },
      },
    });

    // Notify client of session initialization
    res.write(
      `data: ${JSON.stringify({
        type: 'session_init',
        conversationId: conversation.id,
        userMessageId: userMessage.id,
        workflowId: liveWorkflow.id,
        version: liveWorkflow.version,
      })}\n\n`,
    );

    // Fetch past conversation history (up to 20 past messages, excluding current)
    const pastMessages = await this.prisma.message.findMany({
      where: {
        conversationId: conversation.id,
        id: { not: userMessage.id },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    const conversationHistory = pastMessages.reverse().map((m) => {
      let contentText = '';
      if (typeof m.content === 'string') {
        contentText = m.content;
      } else if (m.content && typeof m.content === 'object') {
        contentText =
          (m.content as any).text ||
          (m.content as any).message ||
          JSON.stringify(m.content);
      }
      return {
        role: m.role.toLowerCase() === 'user' ? 'user' : 'assistant',
        content: contentText,
      };
    });

    // Stream from engine with HMAC authentication
    const engineUrl = `${this.engineUrl}/workflow/execute/stream`;
    let engineResp: globalThis.Response;

    try {
      engineResp = await fetch(engineUrl, {
        method: 'POST',
        headers: getEngineAuthHeaders('POST', '/workflow/execute/stream') as any,
        body: JSON.stringify({
          workflow: liveWorkflow.graph,
          workflow_id: liveWorkflow.id,
          project_id: projectId,
          inputs: { user_message: userText },
          session_id: conversation.id,
          conversation_history: conversationHistory,
        }),
        signal: AbortSignal.timeout(90000),
      });

      if (!engineResp.ok || !engineResp.body) {
        let errDetail = `Engine error (${engineResp.status})`;
        try {
          const errJson = await engineResp.json();
          errDetail = errJson.detail || errDetail;
        } catch {}
        res.write(`data: ${JSON.stringify({ type: 'error', error: errDetail })}\n\n`);
        res.end();
        return;
      }
    } catch (err: any) {
      this.logger.error(
        `Failed to connect to engine stream: ${err.message}`,
        err.stack,
        'WorkflowsService',
      );
      const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
      const msg = isTimeout
        ? 'Agent response timed out after 90 seconds.'
        : err.message || 'Workflow streaming failed to start';
      res.write(`data: ${JSON.stringify({ type: 'error', error: msg })}\n\n`);
      res.end();
      return;
    }

    const reader = engineResp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let donePayload: any = null;

    // Handle client disconnection
    let clientDisconnected = false;
    res.on('close', () => {
      clientDisconnected = true;
      reader.cancel().catch(() => {});
    });

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done || clientDisconnected) break;

        const chunkStr = decoder.decode(value, { stream: true });
        res.write(chunkStr);

        buffer += chunkStr;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(trimmed.slice(6));
              if (parsed.type === 'done') {
                donePayload = parsed;
              }
            } catch {}
          }
        }
      }
    } catch (streamErr: any) {
      if (!clientDisconnected) {
        this.logger.error(
          `Error reading stream from engine: ${streamErr.message}`,
          streamErr.stack,
          'WorkflowsService',
        );
        res.write(`data: ${JSON.stringify({ type: 'error', error: streamErr.message })}\n\n`);
      }
    }

    // Persist completed assistant message and execution checkpoint to PostgreSQL via Prisma
    if (donePayload) {
      try {
        const assistantMessage = await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            role: 'ASSISTANT',
            content: {
              text: donePayload.response_text,
              outputs: donePayload.outputs,
            },
            metadata: {
              workflowId: liveWorkflow.id,
              workflowVersion: liveWorkflow.version,
              executionId: donePayload.execution_id,
              stepTraces: donePayload.step_traces,
              durationMs: donePayload.total_duration_ms,
              totalTokens: donePayload.total_tokens,
            },
            model: 'gemini-workflow-agent',
          },
        });

        await this.prisma.workflowExecution.upsert({
          where: { id: donePayload.execution_id || 'unknown-id' },
          update: {
            status: donePayload.status || 'completed',
            outputs: donePayload.outputs || {},
            state: donePayload.state || {},
            trace: donePayload.step_traces || [],
            durationMs: Math.round(donePayload.total_duration_ms || 0),
            totalTokens: donePayload.total_tokens || 0,
          },
          create: {
            id: donePayload.execution_id || undefined,
            workflowId: liveWorkflow.id,
            projectId,
            status: donePayload.status || 'completed',
            inputs: { user_message: userText },
            outputs: donePayload.outputs || {},
            state: donePayload.state || {},
            trace: donePayload.step_traces || [],
            durationMs: Math.round(donePayload.total_duration_ms || 0),
            totalTokens: donePayload.total_tokens || 0,
          },
        });

        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { updatedAt: new Date() },
        });

        if (!clientDisconnected) {
          res.write(
            `data: ${JSON.stringify({
              type: 'persisted',
              conversationId: conversation.id,
              assistantMessageId: assistantMessage.id,
            })}\n\n`,
          );
        }
      } catch (dbErr: any) {
        this.logger.warn(
          `Could not persist streamed assistant message: ${dbErr.message}`,
          'WorkflowsService',
        );
      }
    }

    if (!clientDisconnected) {
      res.end();
    }
  }

  /**
   * Fetch all conversations/sessions for a project with workflow version and messages preview
   */
  async listLiveConversations(projectId: string) {
    return this.prisma.conversation.findMany({
      where: { projectId, isActive: true },
      orderBy: { updatedAt: 'desc' },
      include: {
        workflow: {
          select: { id: true, version: true, note: true },
        },
        _count: {
          select: { messages: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
          },
        },
      },
    });
  }

  /**
   * Fetch a live conversation and its messages
   */
  async getLiveConversation(projectId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, projectId, isActive: true },
      include: {
        workflow: {
          select: { id: true, version: true, note: true },
        },
        messages: {
          orderBy: { createdAt: 'asc' },
          take: 100,
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }
}
