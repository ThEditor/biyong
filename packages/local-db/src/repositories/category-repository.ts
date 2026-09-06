import type { Category } from '@biyong/schemas';
import type { CategoryRepository } from '@biyong/application';
import type { SqliteDriver } from '../driver.js';

interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  parent_category_id: string | null;
  is_builtin: number;
}

function mapRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    parentCategoryId: row.parent_category_id ?? null,
    isBuiltin: Boolean(row.is_builtin),
  };
}

export class SqliteCategoryRepository implements CategoryRepository {
  constructor(private driver: SqliteDriver) {}

  async findAll(): Promise<Category[]> {
    const rows = await this.driver.query<CategoryRow>(
      'SELECT * FROM categories ORDER BY is_builtin DESC, name ASC'
    );
    return rows.map(mapRow);
  }

  async findById(id: string): Promise<Category | null> {
    const row = await this.driver.queryOne<CategoryRow>(
      'SELECT * FROM categories WHERE id = ?',
      [id]
    );
    return row ? mapRow(row) : null;
  }

  async create(category: Category): Promise<void> {
    await this.driver.run(
      `INSERT INTO categories (id, name, icon, parent_category_id, is_builtin)
       VALUES (?, ?, ?, ?, ?)`,
      [
        category.id,
        category.name,
        category.icon ?? 'tag',
        category.parentCategoryId ?? null,
        category.isBuiltin ? 1 : 0,
      ]
    );
  }
}
