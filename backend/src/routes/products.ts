import { z } from 'zod';
import { createCrudRouter } from '../lib/crud.js';

export default createCrudRouter({
  table: 'public.products',
  columns: [
    'restaurant_id',
    'category_id',
    'name',
    'description',
    'image_url',
    'price',
    'discount_price',
    'is_available',
    'preparation_minutes',
  ],
  select: `p.*, r.name AS restaurant_name, c.name AS category_name`,
  from: `public.products p
         LEFT JOIN public.restaurants r ON r.id = p.restaurant_id
         LEFT JOIN public.categories c ON c.id = p.category_id`,
  readIdColumn: 'p.id',
  filters: {
    restaurant_id: 'p.restaurant_id',
    category_id: 'p.category_id',
    is_available: 'p.is_available',
  },
  searchColumns: ['p.name', 'p.description'],
  sortColumns: {
    name: 'p.name',
    price: 'p.price',
    created_at: 'p.created_at',
  },
  orderBy: 'p.created_at DESC',
  publicRead: true,
  validate: async (data) => {
    const price = Number(data.price);
    if (data.price !== undefined && (!Number.isFinite(price) || price < 0)) {
      throw new Error('Үнэ 0-ээс бага байж болохгүй');
    }
    if (data.discount_price !== undefined && data.discount_price !== null) {
      const discount = Number(data.discount_price);
      if (Number.isFinite(discount) && Number.isFinite(price) && discount > price) {
        throw new Error('Хямдрал үнэ үндсэн үнээс их байж болохгүй');
      }
    }
  },
  // keep the price/discount sane when only one of them is sent on PATCH
  beforeWrite: async (data, mode) => {
    if (mode === 'update' && data.discount_price === null) data.discount_price = null;
    return data;
  },
});
