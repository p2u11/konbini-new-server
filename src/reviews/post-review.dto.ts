import { IsInt, IsNotEmpty, IsNumber } from "class-validator";

export class PostReviewDto {
    @IsNumber()
    @IsNotEmpty()
    rating!: number

    comment?: string

    @IsNotEmpty()
    token!: string

    @IsNotEmpty()
    @IsInt()
    appId!: number
}