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
import { WorkflowsService } from './workflows.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  GetWorkflowsQueryDto,
  ExecuteWorkflowDto,
  LiveWorkflowChatDto,
} from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';

@Controller('projects/:projectId/workflows')
export class WorkflowsController {
  constructor(private readonly workflowsService: WorkflowsService) {}

  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  findLive(@Param('projectId') projectId: string) {
    return this.workflowsService.findLive(projectId);
  }

  @Post('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  executeLiveDirect(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.workflowsService.executeLive(projectId, dto);
  }

  @Post('live/run')
  @Public()
  @HttpCode(HttpStatus.OK)
  executeLive(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.workflowsService.executeLive(projectId, dto);
  }

  @Post('live/chat')
  @Public()
  @HttpCode(HttpStatus.OK)
  chatLive(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: LiveWorkflowChatDto,
  ) {
    return this.workflowsService.chatLive(projectId, dto, userId);
  }

  @Get('live/conversations')
  @Public()
  @HttpCode(HttpStatus.OK)
  listLiveConversations(@Param('projectId') projectId: string) {
    return this.workflowsService.listLiveConversations(projectId);
  }

  @Get('live/sessions')
  @Public()
  @HttpCode(HttpStatus.OK)
  listLiveSessions(@Param('projectId') projectId: string) {
    return this.workflowsService.listLiveConversations(projectId);
  }

  @Get('live/conversations/:conversationId')
  @Public()
  @HttpCode(HttpStatus.OK)
  getLiveConversation(
    @Param('projectId') projectId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.workflowsService.getLiveConversation(projectId, conversationId);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Body() dto: CreateWorkflowDto,
  ) {
    return this.workflowsService.create(userId, projectId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Query() query: GetWorkflowsQueryDto,
  ) {
    return this.workflowsService.findAll(userId, projectId, query);
  }

  @Get(':version')
  @HttpCode(HttpStatus.OK)
  findOne(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('version') version: string,
  ) {
    return this.workflowsService.findOne(userId, projectId, version);
  }

  @Patch(':version')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('version') version: string,
    @Body() dto: UpdateWorkflowDto,
  ) {
    return this.workflowsService.update(userId, projectId, version, dto);
  }

  @Post(':version/live')
  @HttpCode(HttpStatus.OK)
  makeLive(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('version') version: string,
  ) {
    return this.workflowsService.makeLive(userId, projectId, version);
  }

  @Delete(':version')
  @HttpCode(HttpStatus.OK)
  delete(
    @CurrentUser('sub') userId: string,
    @Param('projectId') projectId: string,
    @Param('version') version: string,
  ) {
    return this.workflowsService.delete(userId, projectId, version);
  }
}
