import { createCrudRouter } from '../lib/crud.js';

export default createCrudRouter({
  table: 'public.categories',
  columns: ['name', 'image_url', 'sort_order', 'is_active'],
  searchColumns: ['name'],
  orderBy: 'sort_order ASC, name ASC',
  sortColumns: { name: 'name', sort_order: 'sort_order' },
  publicRead: true,
});
