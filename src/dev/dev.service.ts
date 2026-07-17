// dev.service.ts
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'

@Injectable()
export class DeveloperService {
  constructor(private prisma: PrismaService, private authService: AuthService) { }

  async getOwnApps(token: string): Promise<object[]> {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token")

    // filter apps based on the provided API level and architectures
    // note that we need to filter app versions and not apps,
    // because an app can have multiple versions,
    // and each version can support different architectures and API levels.
    const apps = await this.prisma.app.findMany({
      where: {
        uploaderId: validationObject.user.id
      },
      include: {
        versions: true,
        moderatedObject: true
      }
    });

    return apps
  }

  async getApp(appId: number, token: string): Promise<object> {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token")

    const app = await this.prisma.app.findUnique({
      where: {
        id: appId
      },
      include: {
        versions: true,
        moderatedObject: true
      }
    });

    if (app?.uploaderId !== validationObject.user.id)
      throw new ForbiddenException("You don't own this app.")

    return app
  }

  async deleteApp(appId: number, token: string): Promise<{ ok: true | false, message: string, status_code: 200 | 400 | 404 | 403 | 401 }> {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token")

    const app = await this.prisma.app.findUnique({
      where: {
        // 1. The App itself must be approved
        id: appId
      },
      include: {
        versions: true,
        moderatedObject: true
      }
    });

    if (app?.uploaderId !== validationObject.user.id)
      throw new ForbiddenException("You don't own this app.")

    await this.prisma.appVersion.deleteMany({ where: { appId } })
    await this.prisma.moderatedObject.delete({ where: { appId } })
    await this.prisma.app.delete({ where: { id: appId } })

    return { ok: true, message: "Successfully deleted the app.", status_code: 200 }
  }

  async deleteAppVersion(appVersionId: number, token: string): Promise<{ ok: true | false, message: string, status_code: 200 | 400 | 404 | 403 | 401 }> {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token")

    const appVersion = await this.prisma.appVersion.findUnique({
      where: {
        id: appVersionId
      },
      include: {
        app: true,
        moderatedObject: true
      }
    });

    if (appVersion?.uploaderId !== validationObject.user.id)
      throw new ForbiddenException("You don't own this app version.")

    await this.prisma.moderatedObject.delete({ where: { appVersionId } })
    await this.prisma.appVersion.delete({ where: { id: appVersionId } })

    return { ok: true, message: `Successfully deleted app version #${appVersionId}.`, status_code: 200 }
  }
}
