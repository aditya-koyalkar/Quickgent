import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto, UpdateProjectDto, GetProjectsQueryDto } from './dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateProjectDto,
  ) {
    return this.projectsService.create(userId, dto);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: GetProjectsQueryDto,
  ) {
    return this.projectsService.findAll(userId, query);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  findOne(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    return this.projectsService.findOne(userId, id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.update(userId, id, dto);
  }
}
