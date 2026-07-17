import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsBoolean, isNotEmpty, IsInt } from 'class-validator';

export class UploadResourceDto {
  @IsString()
  @IsNotEmpty()
  token!: string
}