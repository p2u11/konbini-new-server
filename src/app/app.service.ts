import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'
import StreamZip from 'node-stream-zip';
import { unlink } from 'fs/promises';
import { CloudflareStorageService } from 'src/cf-storage/cf-storage.service';
import { truncate } from 'fs';

export interface AppShort {
  name: string;
  id: number;
  description: string | null;
  uploaderId: number;
  icon: string
  api: number
  packageName: string
  isGame: boolean
  categoryCode: string
  categoryLabel: string
  rating: number
  downloads: number
}

export interface App {
  name: string;
  id: number;
  description: string | null;
  uploaderId: number;
}

const PUBLIC_ENDPOINT = process.env.R2_PUBLIC_ENDPOINT

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService, private authService: AuthService, private cfStorageService: CloudflareStorageService) { }

  getHello(): string {
    return 'Hello World!';
  }

  async getApps(api?: number, archs: string[] = [], author?: string, category?: string, is_game?: boolean): Promise<AppShort[]> {
    // filter apps based on the provided API level and architectures
    // note that we need to filter app versions and not apps,
    // because an app can have multiple versions,
    // and each version can support different architectures and API levels.
    const apps = await this.prisma.app.findMany({
      where: {
        moderatedObject: {
          status: 'APPROVED'
        },
        versions: {
          some: {
            ...(api !== undefined ? { minSdk: { lte: api } } : {}),
            ...(archs.length > 0
              ? {
                OR: [
                  { abis: { hasSome: archs } },
                  { abis: { equals: [] } }
                ]
              }
              : {}),
            moderatedObject: {
              status: 'APPROVED'
            }
          }
        },
        ...(category !== undefined ? {
          category: {
            cat_id: category
          }
        } : {}),

        ...(is_game !== undefined ? {
          category: {
            type: is_game ? "GAME" : "APP"
          }
        } : {}),

        ...(author !== undefined && author !== '' ? { author } : {}),
      },
      include: {
        resources: true,
        versions: true,
        reviews: true,
        category: true
      },
    });

    return apps.map(app => ({
      name: app.name,
      id: app.id,
      description: app.description,
      uploaderId: app.uploaderId,
      icon: app.resources.find(res => res.type == "ICON")?.downloadUrl ?? "",
      api: app.versions.reduce((min, obj) => Math.min(min, obj.minSdk ?? 0), Infinity),
      packageName: app.packageId,
      isGame: false,
      categoryCode: !!app.category ? app.category.cat_id : "other",
      categoryLabel: !!app.category ? app.category.name : "Other",
      rating: app.reviews.map(rev => rev.rating).reduce((acc, num) => acc + num, 0),
      downloads: 0,
      author: app.author
    }))
  }

  async getApp(appId: number): Promise<App> {
    const app = await this.prisma.app.findUnique({
      where: { id: appId }, include: {
        resources: true,
        versions: true,
        reviews: true,
        category: true
      },
    });
    if (!app) {
      throw new NotFoundException(`App #${appId} not found`);
    }
    return app
  }

  async getAppByPackage(_package: string): Promise<App> {
    const app = await this.prisma.app.findUnique({
      where: { packageId: _package }, include: {
        resources: true,
        versions: true,
        reviews: true,
        category: true
      },
    });
    if (!app) {
      throw new NotFoundException(`App with package ${_package} not found`);
    }
    return app
  }

  async getAppVersions(appId: number, abis: string[] = [], api: number | undefined): Promise<object> {
    const app = await this.prisma.app.findUnique({ where: { id: appId }, include: { versions: true } });
    if (!app) {
      throw new NotFoundException(`App #${appId} not found`);
    }
    if (abis.length !== 0 || api !== undefined) {
      return app.versions.filter(version => {
        // if api is defined and none of the versions are supported
        if (api !== undefined && version.minSdk !== null && version.minSdk > api)
          return false

        // if abis array is not empty and none of the versions are supported
        if (abis.length !== 0 && !version.abis.some((abi) => abis.includes(abi)))
          return false

        return true
      })
    }
    return app.versions
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

  async downloadApp(version_id: number) {
    const version = await this.prisma.appVersion.findUnique({ where: { id: version_id } })
    if (!version)
      throw new NotFoundException("Version not found.")

    // todo: DOESN'T REDIRECT !!! but also nobody gaf
    return {
      url: version.downloadUrl,
      statusCode: HttpStatus.FOUND,
    };
  }

  async searchApps(query: string, limit: number, offset: number, api: number | undefined, archs: string[]) {
    // filter apps based on the provided API level and architectures
    // note that we need to filter app versions and not apps,
    // because an app can have multiple versions,
    // and each version can support different architectures and API levels.
    const apps = await this.prisma.app.findMany({
      where: {
        moderatedObject: {
          status: 'APPROVED'
        },
        versions: {
          some: {
            ...(api !== undefined ? { minSdk: { lte: api } } : {}),
            ...(archs.length > 0
              ? {
                OR: [
                  { abis: { hasSome: archs } },
                  { abis: { equals: [] } }
                ]
              }
              : {}),
            moderatedObject: {
              status: 'APPROVED'
            }
          }
        },
        OR: [
          {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
          {
            packageId: {
              contains: query,
              mode: 'insensitive',
            },
          }
        ]
      },
      include: {
        resources: true,
        versions: true,
        reviews: true,
        category: true
      },
      take: limit,
      skip: offset,
    });

    return apps.map(app => ({
      name: app.name,
      id: app.id,
      description: app.description,
      uploaderId: app.uploaderId,
      icon: app.resources.find(res => res.type == "ICON")?.downloadUrl ?? "",
      api: app.versions.reduce((min, obj) => Math.min(min, obj.minSdk ?? 0), Infinity),
      packageName: app.packageId,
      isGame: false,
      categoryCode: !!app.category ? app.category.cat_id : "other",
      categoryLabel: !!app.category ? app.category.name : "Other",
      rating: app.reviews.map(rev => rev.rating).reduce((acc, num) => acc + num, 0),
      downloads: 0,
    }))
  }
}
