import { Injectable, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/auth/auth.service'
import { Categories } from './categories';

export interface Category {
  id: string,
  name: string,
}

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService, private authService: AuthService) { }

  // categories: { name: string; id: number; cat_id: string; type: 'APP' | 'GAME' }[] | null = null

  async listCategories(type?: 'app' | 'game'): Promise<Category[]> {
    // if (!this.categories) {
    //   this.categories = await this.prisma.category.findMany()
    // }
    // var cats = this.categories
    // if (type !== undefined) {
    //   cats = cats.filter(cat => cat.type === type.toUpperCase())
    // }

    // return cats.map(category => ({ id: category.cat_id, name: category.name }));
    return Object.entries(Categories).filter(([id, info])=>(info.type==type)).map(([id, info]) => {
      return {id, name:info.name}
    })
  }

  async reloadCategories(token: string) {
    const validationObject = await this.authService.validateToken(token)
    if (!validationObject)
      throw new UnauthorizedException("Invalid token.")

    if (!validationObject.user.is_admin)
      throw new ForbiddenException("You're not an admin.")

    // this.categories = await this.prisma.category.findMany()
    return {ok:true,message:'Reloaded category cache.', status_code: 200}
  }
}
