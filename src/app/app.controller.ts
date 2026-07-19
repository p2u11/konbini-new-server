import { Controller, Get, Param, ParseIntPipe, Query, ParseBoolPipe, Ip } from '@nestjs/common';
import {  BadRequestException } from '@nestjs/common';
import { AppService, App } from './app.service';

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

  @Get(':version_id/download')
  async downloadVersion(@Param('version_id', ParseIntPipe) version_id: number, @Ip() ip: string) {
    return await this.appService.downloadApp(version_id, ip)
  }
}
