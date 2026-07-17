import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class ApproveObjectDto {
  @IsNumber()
  @IsNotEmpty()
  id!: number;

  @IsString()
  comment: string = "No reason provided";

  @IsString()
  @IsOptional()
  token?: string;
}