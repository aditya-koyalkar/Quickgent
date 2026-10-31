import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WorkflowsService } from './workflows.service';
import { LiveWorkflowChatDto, ExecuteWorkflowDto } from './dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('live')
export class LiveController {
  constructor(private readonly workflowsService: WorkflowsService) { }

  @Get(':id')
  @Public()
  @HttpCode(HttpStatus.OK)
  findLive(@Param('id') id: string) {
    return this.workflowsService.findLiveById(id);
  }

  @Post(':id/chat')
  @Public()
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  chatLive(
    @Param('id') id: string,
    @Body() dto: LiveWorkflowChatDto,
  ) {
    return this.workflowsService.chatLiveById(id, dto);
  }

  @Post(':id/run')
  @Public()
  @Throttle({ default: { limit: 25, ttl: 60000 } })
  @HttpCode(HttpStatus.OK)
  executeLive(
    @Param('id') id: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.workflowsService.executeLiveById(id, dto);
  }
}
