import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';
import { MAX_PAGE_LIMIT } from '../constants/metadata-keys';

describe('PaginationQueryDto', () => {
  it('applies defaults', async () => {
    const dto = plainToInstance(PaginationQueryDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(20);
    expect(dto.sortOrder).toBe('asc');
  });

  it('rejects limit above maximum', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      page: 1,
      limit: MAX_PAGE_LIMIT + 1,
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'limit')).toBe(true);
  });

  it('rejects invalid sortOrder', async () => {
    const dto = plainToInstance(PaginationQueryDto, {
      sortOrder: 'sideways',
    });
    const errors = await validate(dto);
    expect(errors.some((error) => error.property === 'sortOrder')).toBe(true);
  });
});
