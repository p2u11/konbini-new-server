// dev.controller.ts
import {
    Controller,
    Get,
    Headers,
    Param,
    ParseIntPipe,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { DeveloperService } from './dev.service';

@Controller('api/dev')
export class DeveloperController {
    constructor(private readonly developerService: DeveloperService, private readonly prisma: PrismaService,
        private readonly authService: AuthService) { }

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
}
