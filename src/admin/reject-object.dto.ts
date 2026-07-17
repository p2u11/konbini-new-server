import { IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export class RejectObjectDto {
  @IsNumber()
  @IsNotEmpty()
  id!: number;

  @IsString()
  comment: string = "No reason provided";

  @IsString()
  @IsOptional()
  token?: string;
}