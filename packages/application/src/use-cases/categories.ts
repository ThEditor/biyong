import type { Category } from '@biyong/schemas';
import type { CategoryRepository } from '../repositories.js';

export interface CreateCustomCategoryInput {
  id: string;
  name: string;
  icon?: string;
  parentCategoryId?: string | null;
  isBuiltin?: boolean;
}

export class CategoryUseCases {
  constructor(private categoryRepo: CategoryRepository) {}

  async listCategories(): Promise<Category[]> {
    return this.categoryRepo.findAll();
  }

  /**
   * Create a user-defined custom category.
   * Forces isBuiltin to false.
   */
  async createCustomCategory(input: CreateCustomCategoryInput | Category): Promise<void> {
    const category: Category = {
      id: input.id,
      name: input.name,
      icon: input.icon ?? 'tag',
      parentCategoryId: input.parentCategoryId ?? null,
      isBuiltin: false,
    };
    await this.categoryRepo.create(category);
  }
}
