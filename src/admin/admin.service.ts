// admin.service.ts

import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from 'src/auth/auth.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { RejectObjectDto } from './reject-object.dto';
import { ApproveObjectDto } from './approve-object.dto';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService, private authService: AuthService) { }

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

  async pendingObjects(token: string) {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token.")

    if (!validationObject.user.is_admin)
      throw new ForbiddenException("You're not an admin.")

    return this.prisma.moderatedObject.findMany({where:{status:"PENDING"}})
  }

  async approve(body: ApproveObjectDto, token: string) {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token.")

    if (!validationObject.user.is_admin)
      throw new ForbiddenException("You're not an admin.")

    const moderatedObject = await this.prisma.moderatedObject.findUnique({ where: { id: body.id } })
    if (!moderatedObject)
      throw new BadRequestException("Invalid ModeratedObject ID.")

    await this.prisma.moderatedObject.update({ where: { id: body.id }, data: { status: "APPROVED", comment: body.comment } })

    return {
      ok: true,
      message: 'Object approved.',
      data: moderatedObject,
    };
  }

  async reject(body: RejectObjectDto, token: string) {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token.")

    if (!validationObject.user.is_admin)
      throw new ForbiddenException("You're not an admin.")

    const moderatedObject = await this.prisma.moderatedObject.findUnique({ where: { id: body.id } })
    if (!moderatedObject)
      throw new BadRequestException("Invalid ModeratedObject ID.")

    await this.prisma.moderatedObject.update({ where: { id: body.id }, data: { status: "REJECTED", comment: body.comment } })

    return {
      ok: true,
      message: 'Object rejected.',
      data: moderatedObject,
    };
  }

  async reports(token: string) {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token.")

    if (!validationObject.user.is_admin)
      throw new ForbiddenException("You're not an admin.")

    return this.prisma.reviewReport.findMany({
      where: {
        status: "OPEN"
      }
    })
  }
}
