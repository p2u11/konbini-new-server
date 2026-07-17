import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'
import { PostReviewDto } from './post-review.dto';

@Injectable()
export class ReviewsService {
  constructor(private prisma: PrismaService, private authService: AuthService) { }

  async getReview(id: number) {
    return this.prisma.review.findUnique({ where: { id } })
  }

  async postReview(body: PostReviewDto) {
    if (!body.token)
      throw new UnauthorizedException("Invalid token")

    const tokenValidation = await this.authService.validateToken(body.token)
    if (!tokenValidation)
      throw new UnauthorizedException("Invalid token")

    const review = this.prisma.review.create({
      data: {
        rating: body.rating,
        comment: body.comment,
        app_id: body.appId,
        user_id: tokenValidation.user.id
      }
    })

    return { ok: true, message: "Review posted successfully", data: review, status_code: 200 }
  }

  async reportReview(id: number) {
    if (!this.getReview(id))
      throw new NotFoundException("Review not found.")

    const reported = await this.prisma.reviewReport.findMany({ where: { review_id: id } })
    if (reported.length > 0)
      return { ok: true, message: "Review already reported. Thank you!", status_code: 200 }

    await this.prisma.reviewReport.create({
      data: {
        review_id: id,
      }
    })
    return { ok: true, message: "Review successfully reported. Thank you!", status_code: 200 }
  }
}
