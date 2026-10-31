import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LoggerService } from '../logger/logger.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  SendMessageDto,
  GetConversationsQueryDto,
} from './dto';

@Injectable()
export class ConversationsService {
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
      'http://host.docker.internal:8000';
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
   * Helper to verify conversation belongs to the project
   */
  private async verifyConversationAccess(
    userId: string,
    projectId: string,
    conversationId: string,
  ) {
    await this.verifyProjectAccess(userId, projectId);

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        projectId,
        isActive: true,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  /**
   * Create a new conversation within a project
   */
  async create(userId: string, projectId: string, dto: CreateConversationDto) {
    await this.verifyProjectAccess(userId, projectId);

    const name = dto.name?.trim() || 'Untitled Conversation';

    const conversation = await this.prisma.conversation.create({
      data: {
        name,
        projectId,
      },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    this.logger.log('Conversation created', 'ConversationsService', {
      conversationId: conversation.id,
      projectId,
      userId,
    });

    return conversation;
  }

  /**
   * List conversations for a project
   */
  async findAll(
    userId: string,
    projectId: string,
    query: GetConversationsQueryDto,
  ) {
    await this.verifyProjectAccess(userId, projectId);

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ConversationWhereInput = {
      projectId,
      isActive: true,
    };

    const [total, conversations] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.findMany({
        where,
        skip,
        take: limit,
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
      }),
    ]);

    return {
      data: conversations,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single conversation with paginated message history
   */
  async findOne(
    userId: string,
    projectId: string,
    conversationId: string,
    query?: GetConversationsQueryDto,
  ) {
    await this.verifyConversationAccess(userId, projectId, conversationId);

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const [conversation, totalMessages, messages] = await Promise.all([
      this.prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          workflow: {
            select: { id: true, version: true, note: true },
          },
          _count: {
            select: { messages: true },
          },
        },
      }),
      this.prisma.message.count({
        where: { conversationId },
      }),
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return {
      ...conversation,
      messages,
      messagesMeta: {
        total: totalMessages,
        page,
        limit,
        totalPages: Math.ceil(totalMessages / limit) || 1,
      },
    };
  }

  /**
   * Get paginated messages for a conversation
   */
  async findMessages(
    userId: string,
    projectId: string,
    conversationId: string,
    query: GetConversationsQueryDto,
  ) {
    await this.verifyConversationAccess(userId, projectId, conversationId);

    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 50));
    const skip = (page - 1) * limit;

    const [total, messages] = await Promise.all([
      this.prisma.message.count({
        where: { conversationId },
      }),
      this.prisma.message.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      data: messages,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Update conversation title or status
   */
  async update(
    userId: string,
    projectId: string,
    conversationId: string,
    dto: UpdateConversationDto,
  ) {
    await this.verifyConversationAccess(userId, projectId, conversationId);

    const data: Prisma.ConversationUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data,
    });

    return updated;
  }

  /**
   * Delete conversation and its messages
   */
  async delete(userId: string, projectId: string, conversationId: string) {
    await this.verifyConversationAccess(userId, projectId, conversationId);

    await this.prisma.$transaction([
      this.prisma.message.deleteMany({
        where: { conversationId },
      }),
      this.prisma.conversation.delete({
        where: { id: conversationId },
      }),
    ]);

    return {
      success: true,
      message: 'Conversation deleted successfully',
    };
  }

  /**
   * Send user message to conversation, invoke Engine AI agent copilot,
   * persist user and assistant messages, and return the response.
   */
  async sendMessage(
    userId: string,
    projectId: string,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const conversation = await this.verifyConversationAccess(
      userId,
      projectId,
      conversationId,
    );

    const userText = dto.message.trim();
    if (!userText) {
      throw new BadRequestException('Message cannot be empty');
    }

    // 1. Save User Message to Database
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'USER',
        content: { text: userText },
        metadata: {
          hasWorkflowAttached: Boolean(dto.currentWorkflow),
        },
      },
    });

    // 2. Call apps/engine Copilot Generation Endpoint directly with conversationId
    let engineResult: {
      explanation: string;
      architecture_highlights: string[];
      workflow: any;
      needs_clarification?: boolean;
      clarification_questions?: string[];
      metadata?: any;
    };

    try {
      const engineUrl = `${this.engineUrl}/copilot/generate`;
      this.logger.debug(
        `Invoking Engine copilot at ${engineUrl} for conversation ${conversationId}`,
        'ConversationsService',
      );

      const response = await fetch(engineUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instruction: userText,
          current_workflow: dto.currentWorkflow,
          conversation_id: conversationId,
          project_id: projectId,
        }),
      });

      if (!response.ok) {
        let errorDetail = `Engine responded with status ${response.status}`;
        try {
          const errorJson = await response.json();
          errorDetail = errorJson.detail || errorDetail;
        } catch {
          const errorText = await response.text();
          if (errorText) errorDetail = errorText;
        }
        throw new BadRequestException(errorDetail);
      }

      engineResult = await response.json();
    } catch (err: any) {
      this.logger.error(
        `Engine copilot generation failed: ${err.message}`,
        err.stack,
        'ConversationsService',
      );
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new BadRequestException(
        err?.message || 'Failed to generate response from AI Copilot',
      );
    }

    // 4. Save Assistant Response to Database
    const assistantMessage = await this.prisma.message.create({
      data: {
        conversationId,
        role: 'ASSISTANT',
        content: {
          text: engineResult.explanation,
          suggestedWorkflow: engineResult.workflow || undefined,
          highlights: engineResult.architecture_highlights || [],
          needsClarification: engineResult.needs_clarification || false,
          clarificationQuestions: engineResult.clarification_questions || [],
        },
        metadata: {
          ...(engineResult.metadata || {}),
          needsClarification: engineResult.needs_clarification || false,
        },
        model: engineResult.metadata?.model || 'gemini-3.8-flash',
      },
    });

    // 5. Update Conversation timestamp and title if it was default
    const updateData: Prisma.ConversationUpdateInput = {
      updatedAt: new Date(),
    };

    if (
      conversation.name === 'Untitled Conversation' ||
      !conversation.name.trim()
    ) {
      updateData.name = userText.length > 35 ? `${userText.slice(0, 35)}…` : userText;
    }

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
    });

    return {
      userMessage,
      assistantMessage,
      suggestedWorkflow: engineResult.workflow || null,
      highlights: engineResult.architecture_highlights || [],
      needsClarification: engineResult.needs_clarification || false,
      clarificationQuestions: engineResult.clarification_questions || [],
    };
  }
}
