// storage.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common';
import { S3Client, PutObjectCommand, S3 } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import path from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import fs from 'fs';

const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME

@Injectable()
export class CloudflareStorageService implements OnModuleInit {
  private r2Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) { }

  onModuleInit() {
    console.log(R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY)
    this.r2Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID ?? "",
        secretAccessKey: R2_SECRET_ACCESS_KEY ?? ""
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED'
    })

    this.bucketName = R2_BUCKET_NAME ?? "<undefined>";
  }

  async uploadFileFromDisk(localFilePath: string, uploadTo: string, filename?: string): Promise<string> {
    const originalFilename = path.basename(localFilePath);
    const storageKey = `${uploadTo}/${filename??originalFilename}`;

    const fileStream = fs.createReadStream(localFilePath);

    const parallelUploadToR2 = new Upload({
      client: this.r2Client,
      params: {
        Bucket: this.bucketName,
        Key: storageKey,
        Body: fileStream,
        ContentType: 'application/vnd.android.package-archive',
      },
      queueSize: 4,
      partSize: 1024 * 1024 * 5,
    });

    try {
      await parallelUploadToR2.done();

      fs.unlink(localFilePath, (err) => {
        if (err) console.error(`Failed to delete local file at ${localFilePath}:`, err);
      });

      return storageKey;
    } catch (error: any) {
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }

      if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);

      console.error("--- DETAILED R2 ERROR LOG ---");
      console.error("Error Name:", error.name);
      console.error("Status Code:", error.$metadata);
      console.error("Message:", error.message);

      throw new Error(`R2 Upload failed: ${error.name} - ${error.message}`);
    }
  }
}
