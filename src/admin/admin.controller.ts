// admin.controller.ts

import {
    Body,
    Controller,
    Get,
    Headers,
    Post,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { RejectObjectDto } from './reject-object.dto';
import { ApproveObjectDto } from './approve-object.dto';

@Controller('api/admin')
export class AdminController {
    constructor(private readonly adminService: AdminService, private readonly prisma: PrismaService,
        private readonly authService: AuthService) { }

    private getToken(req: any, queryToken?: string, bodyToken?: string, authorizationHeader?: string): string {
        const token = this.adminService.resolveToken(req, queryToken, bodyToken, authorizationHeader);
        if (!token) {
            throw new UnauthorizedException('No token provided.');
        }
        return token;
    }

    @Get('pendingObjects')
    pendingObjects(@Req() req: any, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, token, undefined, authorization);
        return this.adminService.pendingObjects(resolvedToken);
    }

    @Post('approve')
    approve(@Req() req: any, @Body() body: ApproveObjectDto, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, body.token, authorization);
        return this.adminService.approve(body, resolvedToken);
    }

    @Post('reject')
    reject(@Req() req: any, @Body() body: RejectObjectDto, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, undefined, body.token, authorization);
        return this.adminService.reject(body, resolvedToken);
    }

    @Get('reports')
    reports(@Req() req: any, @Query('token') token?: string, @Headers('authorization') authorization?: string) {
        const resolvedToken = this.getToken(req, token, undefined, authorization);
        return this.adminService.reports(resolvedToken);
    }
}
