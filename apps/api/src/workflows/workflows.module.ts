import { Module } from '@nestjs/common';
import { WorkflowsController } from './workflows.controller';
import { LiveController } from './live.controller';
import { WorkflowsService } from './workflows.service';

@Module({
  controllers: [WorkflowsController, LiveController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule { }
