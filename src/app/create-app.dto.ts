import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, IsBoolean, isNotEmpty } from 'class-validator';

export class CreateAppDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsBoolean()
  own_app: boolean = false;

  @IsString()
  @IsNotEmpty()
  author!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  token!: string

  @IsString()
  @IsOptional()
  category: string = "other"
}