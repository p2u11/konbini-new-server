// dev.controller.ts
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Headers,
    InternalServerErrorException,
    Param,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UnauthorizedException,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { DeveloperService } from './dev.service';
import { CloudflareStorageService } from 'src/cf-storage/cf-storage.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateAppDto } from 'src/app/create-app.dto';
import { createHash } from 'crypto';
import { extname, join } from 'path';
import { unlink, writeFile } from 'fs/promises';
import { UploadResourceDto } from 'src/app/upload-resource.dto';
import { existsSync, mkdirSync } from 'fs';
import { UpdateAppDto } from './update-app.dto';

const uploadPath = join(process.cwd(), 'uploads');
if (!existsSync(uploadPath)) {
  mkdirSync(uploadPath, { recursive: true });
}


@Controller('api/dev')
export class DeveloperController {
    constructor(private readonly developerService: DeveloperService, private readonly prisma: PrismaService,
        private readonly authService: AuthService, private readonly cfStorageService: CloudflareStorageService) { }

    resolveToken(
        req: { query?: Record<string, any>; body?: Record<string, any>; headers?: Record<string, string | undefined> },
        queryToken?: string,
        bodyToken?: string,
        authorizationHeader?: string,
    ): string | undefined {
        const queryValue = req?.query?.token ?? queryToken;
        const bodyValue = req?.body?.token ?? bodyToken;
        const headerToken = authorizationHeader ?? req?.headers?.authorization;
        const normalizedHeaderToken = headerToken?.startsWith('Bearer ')
            ? headerToken.slice(7).trim()
            : headerToken?.trim();

        return [queryValue, bodyValue, normalizedHeaderToken]
            .map((value) => value?.trim())
            .find((value): value is string => Boolean(value));
    }

    private getToken(req: any, queryToken?: string, bodyToken?: string, authorizationHeader?: string): string {
        const token = this.resolveToken(req, queryToken, bodyToken, authorizationHeader);
        if (!token) {
            throw new UnauthorizedException('No token provided.');
        }
        return token;
    }

    @Get('getOwnApps')
    async getOwnApps(@Req() req: any, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, token, authorization);
        return await this.developerService.getOwnApps(resolvedToken);
    }

    @Get('app/:id')
    async getApp(@Req() req: any, @Param('id', ParseIntPipe) appId: number, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, token, authorization);
        return await this.developerService.getApp(appId, resolvedToken);
    }

    @Post('app/:id')
    async updateApp(@Req() req: any, @Param('id', ParseIntPipe) appId: number, @Body() updateData: UpdateAppDto, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, updateData.token, token, authorization);
        return await this.developerService.updateApp(appId, updateData, resolvedToken);
    }

    @Get('app/:id/delete')
    async deleteApp(@Req() req: any, @Param('id', ParseIntPipe) appId: number, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, token, authorization);
        return await this.developerService.deleteApp(appId, resolvedToken);
    }

    @Get('version/:id/delete')
    async deleteAppVersion(@Req() req: any, @Param('id', ParseIntPipe) appId: number, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, token, authorization);
        return await this.developerService.deleteAppVersion(appId, resolvedToken);
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

            return await this.developerService.processAndSaveApk(file, hash, body.name,
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

            return await this.developerService.uploadIcon(file, hash, app_id, body.token);
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

            return await this.developerService.uploadScreenshot(file, hash, app_id, body.token);
        } catch (error) {
            await unlink(filePath).catch(() => undefined);
            throw error;
        }
    }
}
