// dev.service.ts
import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'
import { CloudflareStorageService } from 'src/cf-storage/cf-storage.service';
import StreamZip from 'node-stream-zip';
import { unlink } from 'fs/promises';

const PUBLIC_ENDPOINT = process.env.R2_PUBLIC_ENDPOINT

@Injectable()
export class DeveloperService {
  constructor(private prisma: PrismaService, private authService: AuthService, private cfStorageService: CloudflareStorageService) { }

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
        moderatedObject: true,
        resources: true
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

  async processAndSaveApk(file: Express.Multer.File, sha256: string,
    name: string, author: string, userDescription: string,
    ownApp: boolean = false, token: string): Promise<any> {
    console.log({ name, author, userDescription, ownApp });

    const tokenValidation = await this.authService.validateToken(token);
    if (!tokenValidation || !tokenValidation.user) {
      throw new UnauthorizedException("Invalid token.")
    }
    if (!tokenValidation.user.can_upload && !tokenValidation.user.is_admin) {
      throw new ForbiddenException("This account can't upload apps.")
    }

    let app = await this.prisma.appVersion.findUnique({
      where: { sha256 }
    });

    if (app) {
      throw new BadRequestException('This APK has already been uploaded.');
    }

    let packageId = '';
    let versionName = '';
    let versionCode: number | undefined;
    let minSdkVersion: number | undefined;
    let abis: string[] = [];

    try {
      const ApkReader = require('adbkit-apkreader');
      const reader = await ApkReader.open(file.path);
      const manifest = await reader.readManifest();

      console.log(manifest)

      packageId = manifest.package;
      versionName = manifest.versionName;
      versionCode = manifest.versionCode;
      minSdkVersion = manifest.usesSdk.minSdkVersion;

      if (!packageId) {
        throw new BadRequestException('Invalid APK binary file. Could not extract package ID.');
      }

      if (!versionName) {
        throw new BadRequestException('Invalid APK binary file. Could not extract version name.');
      }

      if (!versionCode) {
        throw new BadRequestException('Invalid APK binary file. Could not extract version code.');
      }

      if (!minSdkVersion) {
        throw new BadRequestException('Invalid APK binary file. Could not extract minimum SDK version.');
      }

      const zip = new StreamZip.async({ file: file.path });
      try {
        const entries = await zip.entries();
        const libs = Object.values(entries).filter((entry: any) => entry.name.startsWith('lib/'));
        console.log(libs);
        libs.forEach((lib: any) => {
          console.log(`Found library: ${lib.name}`);
        });
        abis = [...new Set(libs.map((lib: any) => lib.name.split('/')[1]))];
        console.log('Extracted ABIs:', abis);
      } catch (err) {
        console.error('Error reading zip file:', err);
        throw new BadRequestException('Invalid APK binary file. Could not read zip entries.');
      } finally {
        await zip.close();
      }

      const r2_filepath = await this.cfStorageService.uploadFileFromDisk(file.path, `apk/${packageId}`)

      let app = await this.prisma.app.findUnique({
        where: { packageId }
      });

      if (!app) {
        const moderatedObject = await this.prisma.moderatedObject.create({
          data: { objectType: "APP", status: (tokenValidation.user.is_admin) ? "APPROVED" : "PENDING" }
        })
        app = await this.prisma.app.create({
          data: {
            name,
            packageId,
            author: ownApp ? tokenValidation.user.name : author,
            description: userDescription,
            uploaderId: 1,
            moderatedObjectId: moderatedObject.id
          }
        });
        await this.prisma.moderatedObject.update({ where: { id: moderatedObject.id }, data: { appId: app.id } })
      }

      const moderatedObject = await this.prisma.moderatedObject.create({
        data: { objectType: "APP_VERSION", status: (tokenValidation.user.is_admin) ? "APPROVED" : "PENDING" }
      })
      const newVersion = await this.prisma.appVersion.create({
        data: {
          versionName: versionName ?? '1.0.0',
          versionCode: versionCode ? Number(versionCode) : 1,
          minSdk: minSdkVersion ? Number(minSdkVersion) : 1,
          abis: abis,
          downloadUrl: PUBLIC_ENDPOINT + r2_filepath,
          appId: app.id,
          uploaderId: tokenValidation.user.id,
          sha256,
          moderatedObjectId: moderatedObject.id
        },
      });
      await this.prisma.moderatedObject.update({ where: { id: moderatedObject.id }, data: { appVersionId: newVersion.id } })

      return {
        message: 'APK processed and uploaded successfully!',
        app,
        newVersion,
        versionId: newVersion.id
      };
    } catch (error) {
      console.error('Error occurred while processing APK:', error);
      if (file.path) {
        await unlink(file.path).catch(() => undefined);
      }
      throw error;
    }
  }

  async uploadIcon(file: Express.Multer.File, sha256: string, app_id: number, token: string) {
    console.log({ file, sha256, app_id, token });

    const tokenValidation = await this.authService.validateToken(token);
    if (!tokenValidation || !tokenValidation.user) {
      throw new UnauthorizedException("Invalid token.")
    }
    if (!tokenValidation.user.can_upload && !tokenValidation.user.is_admin) {
      throw new ForbiddenException("This account can't upload resources.")
    }

    let app = await this.prisma.app.findFirst({ where: { id: app_id } });
    if (!app) {
      throw new BadRequestException('Invalid app ID.');
    }

    if (await this.prisma.appResource.findFirst({ where: { type: "ICON", appId: app_id } })) {
      throw new BadRequestException('An icon was already uploaded for this app. Please delete the previous icon and try again.');
    }

    const cf_path = await this.cfStorageService.uploadFileFromDisk(file.path, `resources/${app.packageId}`)

    const moderatedObject = await this.prisma.moderatedObject.create({
      data: {
        objectType: "RESOURCE",
      }
    })
    const icon = await this.prisma.appResource.create({
      data: {
        type: 'ICON',
        downloadUrl: PUBLIC_ENDPOINT + cf_path,
        appId: app_id,
        uploaderId: tokenValidation.user.id,
        moderatedObjectId: moderatedObject.id
      }
    })
    await this.prisma.moderatedObject.update({ where: { id: moderatedObject.id }, data: { resourceId: icon.id } })
    return { ok: true, message: 'Successfully uploaded the icon', data: icon }
  }

  async uploadScreenshot(file: Express.Multer.File, sha256: string, app_id: number, token: string) {
    console.log({ file, sha256, app_id, token });

    const tokenValidation = await this.authService.validateToken(token);
    if (!tokenValidation || !tokenValidation.user) {
      throw new UnauthorizedException("Invalid token.")
    }
    if (!tokenValidation.user.can_upload && !tokenValidation.user.is_admin) {
      throw new ForbiddenException("This account can't upload resources.")
    }

    let app = await this.prisma.app.findFirst({ where: { id: app_id } });
    if (!app) {
      throw new BadRequestException('Invalid app ID.');
    }

    if ((await this.prisma.appResource.findMany({ where: { type: "SCREENSHOT", appId: app_id } })).length >= 7) {
      throw new BadRequestException('Too much screenshots were already uploaded for this app. Please delete previous screenshot(s) and try again.');
    }

    const cf_path = await this.cfStorageService.uploadFileFromDisk(file.path, `resources/${app.packageId}`)

    const moderatedObject = await this.prisma.moderatedObject.create({
      data: {
        objectType: "RESOURCE",
      }
    })
    const sshot = await this.prisma.appResource.create({
      data: {
        type: 'SCREENSHOT',
        downloadUrl: PUBLIC_ENDPOINT + cf_path,
        appId: app_id,
        uploaderId: tokenValidation.user.id,
        moderatedObjectId: moderatedObject.id
      }
    })
    await this.prisma.moderatedObject.update({ where: { id: moderatedObject.id }, data: { resourceId: sshot.id } })
    return { ok: true, message: 'Successfully uploaded a screenshot', data: sshot }
  }
}
