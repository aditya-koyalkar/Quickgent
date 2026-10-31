import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConversationsService } from './conversations.service';
import {
  CreateConversationDto,
  UpdateConversationDto,
  SendMessageDto,
  GetConversationsQueryDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects/:projectId/conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateConversationDto,
  ) {
    return this.conversationsService.create(userId, projectId, dto);
  }

  @Get()
  findAll(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Query() query: GetConversationsQueryDto,
  ) {
    return this.conversationsService.findAll(userId, projectId, query);
  }

  @Get(':id')
  findOne(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query() query: GetConversationsQueryDto,
  ) {
    return this.conversationsService.findOne(userId, projectId, id, query);
  }

  @Get(':id/messages')
  findMessages(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Query() query: GetConversationsQueryDto,
  ) {
    return this.conversationsService.findMessages(userId, projectId, id, query);
  }

  @Patch(':id')
  update(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateConversationDto,
  ) {
    return this.conversationsService.update(userId, projectId, id, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.conversationsService.delete(userId, projectId, id);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  sendMessage(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(userId, projectId, id, dto);
  }
}
