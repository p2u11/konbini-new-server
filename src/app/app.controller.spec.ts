import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'crypto';
import { existsSync, unlinkSync } from 'fs';
import { extname, join } from 'path';

describe('AppController', () => {
  let appController: AppController;
  let appService: { processAndSaveApk: jest.Mock; getApps: jest.Mock };
  let app: INestApplication;

  beforeEach(async () => {
    appService = {
      processAndSaveApk: jest.fn(),
      getApps: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: appService }],
    }).compile();

    appController = module.get<AppController>(AppController);
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns an empty list when no query parameters are provided', async () => {
    await request(app.getHttpServer())
      .get('/api/apps')
      .expect(200)
      .expect([]);

    expect(appService.getApps).toHaveBeenCalledWith(undefined, []);
  });

  it('removes the uploaded file when processing fails', async () => {
    appService.processAndSaveApk.mockRejectedValueOnce(new Error('boom'));

    const file = {
      originalname: 'example.apk',
      buffer: Buffer.from('test-data'),
    } as Express.Multer.File;
    const body = {
      name: 'Test App',
      author: 'Test Author',
      own_app: false,
      description: 'A test app',
    };

    const hash = createHash('sha256').update(file.buffer).digest('hex');
    const filePath = join(process.cwd(), 'uploads', `${hash}${extname(file.originalname) || '.apk'}`);

    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }

    await expect(appController.uploadFile(body as any, file as any)).rejects.toThrow('boom');
    expect(existsSync(filePath)).toBe(false);
  });
});
