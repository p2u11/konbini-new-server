import { Injectable, NotFoundException, HttpStatus } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'
import { CloudflareStorageService } from 'src/cf-storage/cf-storage.service';

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
