import {
    Body,
    Controller,
    Get,
    Headers,
    Param,
    ParseArrayPipe,
    ParseIntPipe,
    Post,
    Query,
    Req,
    UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service';
import { ReviewsService } from './reviews.service';
import { PostReviewDto } from './post-review.dto';

@Controller('api/reviews')
export class ReviewsController {
    constructor(private readonly reviewsService: ReviewsService, private readonly prisma: PrismaService,
        private readonly authService: AuthService) { }

    resolveToken(
        req: { query?: Record<string, any>; body?: Record<string, any>; headers?: Record<string, string | undefined> },
        queryToken?: string,
        bodyToken?: string,
        authorizationHeader?: string,
    ): string | undefined {
        const queryValue = req?.query?.token ?? queryToken;
        const bodyValue = req?.body?.token ?? bodyToken;
        const headerToken = authorizationHeader ?? req?.headers?.authorization;
        const normalizedHeaderToken = headerToken?.startsWith('Bearer ')
            ? headerToken.slice(7).trim()
            : headerToken?.trim();

        return [queryValue, bodyValue, normalizedHeaderToken]
            .map((value) => value?.trim())
            .find((value): value is string => Boolean(value));
    }

    private getToken(req: any, queryToken?: string, bodyToken?: string, authorizationHeader?: string): string {
        const token = this.resolveToken(req, queryToken, bodyToken, authorizationHeader);
        if (!token) {
            throw new UnauthorizedException('No token provided.');
        }
        return token;
    }

    @Get(':id')
    async getReview(@Param('id', ParseIntPipe) review_id: number) {
        return await this.reviewsService.getReview(review_id);
    }

    @Post('new')
    async postReview(@Body() body : PostReviewDto, @Req() req: any, @Query('token') token?: string, @Headers('authorization') authorization?: string){
        const _token = this.resolveToken(req, token, body.token, authorization);
        if (!token) {
            throw new UnauthorizedException('No token provided.');
        }
        return this.reviewsService.postReview(body)
    }

    @Get(':id/report')
    async reportReview(@Query('id', ParseIntPipe) id: number){
        return this.reviewsService.reportReview(id)
    }
}
