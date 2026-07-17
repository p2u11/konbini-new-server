import {
    Controller,
    Get,
    Param,
    Query,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
    constructor(private readonly categoriesService: CategoriesService) { }

    @Get('list')
    async listCategories(@Query('type') type?: 'app'|'game') {
        return await this.categoriesService.listCategories(type)
    }

    @Get('reload')
    async reloadCategories(@Query('token') token: string) {

    }
}
