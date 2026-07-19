import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthController } from '../auth/auth.controller';
import { AuthService } from '../auth/auth.service';
import { AdminController } from 'src/admin/admin.controller';
import { AdminService } from 'src/admin/admin.service';
import { CategoriesService } from 'src/categories/categories.service';
import { CloudflareStorageService } from 'src/cf-storage/cf-storage.service';
import { ConfigService } from '@nestjs/config';
import { CategoriesController } from 'src/categories/categories.controller';
import { DeveloperController } from 'src/dev/dev.controller';
import { DeveloperService } from 'src/dev/dev.service';

@Module({
  imports: [],
  controllers: [AppController, AuthController, AdminController, CategoriesController, DeveloperController],
  providers: [AppService, AuthService, PrismaService, AdminService, CategoriesService, CloudflareStorageService, DeveloperService, ConfigService],
})
export class AppModule { }
