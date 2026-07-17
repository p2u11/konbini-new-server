import { Controller, Get, Param, ParseIntPipe, Body, UploadedFile, Query, Optional, Req, UnauthorizedException, ParseBoolPipe } from '@nestjs/common';
import { UseInterceptors, Post, BadRequestException } from '@nestjs/common';
import { InternalServerErrorException } from '@nestjs/common';
import { AppService, App } from './app.service';
import type { Express } from 'express';
import { CreateAppDto } from './create-app.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createHash } from 'crypto';
import { join, extname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { unlink, writeFile } from 'fs/promises';
import { UploadResourceDto } from './upload-resource.dto';

const uploadPath = join(process.cwd(), 'uploads');
if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true });
}

const validArchitectures = [
  'armeabi',
  'armeabi-v7a',
  'arm64-v8a',
  'x86',
  'x86_64',
  'mips',
  'mips64',
  'riscv64', // good luck finding apps for this thing...
];

const packageRegex = /^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)+$/;

@Controller('api/apps')
export class AppController {
  constructor(private readonly appService: AppService) { }

  // api is the minimum API level of the device, and abis is a comma-separated list of supported ABIs (Application Binary Interfaces) for the device.
  // both are optional, but if provided, the server will filter the apps based on these parameters.
  @Get()
  async getApps(
    @Query('api', new ParseIntPipe({ optional: true })) api?: number,
    @Query('abis') abis?: string,
    @Query('category') category?: string,
    @Query('author') author?: string,
    @Query('is_game', new ParseBoolPipe({ optional: true })) is_game: boolean = false
  ): Promise<object[]> {
    const archs = abis ? abis.split(',').map(arch => arch.trim()).filter(Boolean) : [];
    // check if at least one of the provided architectures is valid
    if (archs.length > 0 && !archs.some(arch => validArchitectures.includes(arch))) {
      // we don't filter archs because we don't support any of them
      throw new BadRequestException(`Sorry, but we don't support your device\'s architecture (${archs}). Supported architectures are: ${validArchitectures.join(', ')}`);
    }

    return this.appService.getApps(api, archs, author, category, is_game);
  }

  @Get('search')
  async searchApps(
    @Query('q') query: string,
    @Query('limit', new ParseIntPipe({optional:true})) limit: number,
    @Query('offset', new ParseIntPipe({optional: true})) offset: number,
    @Query('api', new ParseIntPipe({ optional: true })) api?: number,
    @Query('abis') abis?: string,
  ) {
    const archs = abis?.split(',') ?? []
    return this.appService.searchApps(query, limit, offset, api, archs);
  }

  @Get(':identifier')
  async getApp(@Param('identifier') identifier: string): Promise<App> {
    const id = parseInt(identifier, 10);
    
    if (!isNaN(id)) {
      return await this.appService.getApp(id);
    }

    if (!packageRegex.test(identifier)) {
      throw new BadRequestException("Invalid package ID.");
    }

    return await this.appService.getAppByPackage(identifier);
  }

  @Get(':id/versions')
    async getAppVersions(@Param('id', ParseIntPipe) id: number,
      @Query('abi') abis?: string,
      @Query('api', new ParseIntPipe({ optional: true })) api?: number): Promise<object> {
    const archs = abis ? abis.split(',').map(arch => arch.trim()).filter(Boolean) : [];
    // check if at least one of the provided architectures is valid
    if (archs.length > 0 && !archs.some(arch => validArchitectures.includes(arch))) {
      // we don't filter archs because we don't support any of them
      throw new BadRequestException(`Sorry, but we don't support your device\'s architecture (${archs}). Supported architectures are: ${validArchitectures.join(', ')}`);
    }
    return await this.appService.getAppVersions(id, archs, api)
  }

  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: (_req, file, callback) => { callback(null, true); } }))
  @Post('upload')
  async uploadFile(
    @Body() body: CreateAppDto,
    @UploadedFile() file: Express.Multer.File
  ) {
    console.log(body)

    if (!body.name)
      throw new BadRequestException('App name is required.');
    if (!body.author && !body.own_app)
      throw new BadRequestException('Author name is required. If you want your app to be listed as your own, please set the "own_app" field to true.');
    if (!file || !file.buffer)
      throw new BadRequestException('File upload failed or buffer was not available.');

    if (!file || !file.buffer) {
      console.error('File upload failed or buffer was not available.');
      throw new InternalServerErrorException();
    }

    if (!body.token) {
      throw new UnauthorizedException("No token provided.")
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const fileExt = extname(file.originalname) || '.apk';
    const fileName = `${hash}${fileExt}`;
    const filePath = join(uploadPath, fileName);

    try {
      await writeFile(filePath, file.buffer);
      file.path = filePath;

      console.log(body);

      return await this.appService.processAndSaveApk(file, hash, body.name,
        body.author, body.description ?? '', body.own_app, body.token);
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: (_req, file, callback) => { callback(null, true); } }))
  @Post(':id/upload-icon')
  async uploadIcon(@Body() body: UploadResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) app_id?: number
  ) {
    console.log(body)

    if (!file || !file.buffer)
      throw new BadRequestException('File upload failed or buffer was not available.');

    if (!file || !file.buffer) {
      console.error('File upload failed or buffer was not available.');
      throw new InternalServerErrorException();
    }

    if (!body.token) {
      throw new UnauthorizedException("No token provided.")
    }

    if (!app_id) {
      throw new BadRequestException("Invalid app ID")
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const fileExt = extname(file.originalname) || '.png';
    const fileName = `${hash}${fileExt}`;
    const filePath = join(uploadPath, fileName);

    try {
      await writeFile(filePath, file.buffer);
      file.path = filePath;

      console.log(body);

      return await this.appService.uploadIcon(file, hash, app_id, body.token);
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), fileFilter: (_req, file, callback) => { callback(null, true); } }))
  @Post(':id/upload-screenshot')
  async uploadScreenshot(@Body() body: UploadResourceDto,
    @UploadedFile() file: Express.Multer.File,
    @Param('id', ParseIntPipe) app_id?: number
  ) {
    console.log(body)

    if (!file || !file.buffer)
      throw new BadRequestException('File upload failed or buffer was not available.');

    if (!file || !file.buffer) {
      console.error('File upload failed or buffer was not available.');
      throw new InternalServerErrorException();
    }

    if (!body.token) {
      throw new UnauthorizedException("No token provided.")
    }

    if (!app_id) {
      throw new BadRequestException("Invalid app ID")
    }

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const fileExt = extname(file.originalname) || '.png';
    const fileName = `${hash}${fileExt}`;
    const filePath = join(uploadPath, fileName);

    try {
      await writeFile(filePath, file.buffer);
      file.path = filePath;

      console.log(body);

      return await this.appService.uploadScreenshot(file, hash, app_id, body.token);
    } catch (error) {
      await unlink(filePath).catch(() => undefined);
      throw error;
    }
  }

  @Get(':version_id/download')
  async downloadVersion(@Param('version_id', ParseIntPipe) version_id: number) {
    return await this.appService.downloadApp(version_id)
  }
}
