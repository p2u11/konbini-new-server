import { IsBoolean, IsOptional, IsString } from "class-validator";

export class UpdateAppDto {
    @IsOptional()
    @IsString()
    token?: string

    @IsOptional()
    @IsString()
    name?: string

    @IsOptional()
    @IsString()
    category?: string

    @IsOptional()
    @IsString()
    description?: string

    @IsOptional()
    @IsString()
    author?: string

    @IsOptional()
    @IsBoolean()
    own_app?: boolean
}