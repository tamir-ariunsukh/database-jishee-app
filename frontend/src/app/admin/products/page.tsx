'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { EmptyState, PageHeader } from '@/components/admin/page-header';
import { api, errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Category, Product, Restaurant } from '@/lib/types';

interface FormState {
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  image_url: string;
  price: string;
  discount_price: string;
  preparation_minutes: string;
  is_available: boolean;
}

const EMPTY: FormState = {
  restaurant_id: '',
  category_id: '',
  name: '',
  description: '',
  image_url: '',
  price: '',
  discount_price: '',
  preparation_minutes: '15',
  is_available: true,
};

export default function AdminProductsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [restaurantFilter, setRestaurantFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '200' });
    if (query) params.set('q', query);
    if (restaurantFilter !== 'all') params.set('restaurant_id', restaurantFilter);
    if (categoryFilter !== 'all') params.set('category_id', categoryFilter);
    return `/products?${params.toString()}`;
  }, [query, restaurantFilter, categoryFilter]);

  const { data: products, loading, reload } = useList<Product>(url);
  const { data: restaurants } = useList<Restaurant>('/restaurants?limit=100&is_active=all');
  const { data: categories } = useList<Category>('/categories?limit=100');

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Product | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      restaurant_id: restaurantFilter !== 'all' ? restaurantFilter : restaurants[0]?.id ?? '',
    });
    setOpen(true);
  };

  const openEdit = (product: Product) => {
    setEditing(product);
    setForm({
      restaurant_id: product.restaurant_id,
      category_id: product.category_id ?? '',
      name: product.name,
      description: product.description ?? '',
      image_url: product.image_url ?? '',
      price: String(product.price),
      discount_price: product.discount_price != null ? String(product.discount_price) : '',
      preparation_minutes: product.preparation_minutes != null ? String(product.preparation_minutes) : '',
      is_available: product.is_available,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Бүтээгдэхүүний нэр оруулна уу');
      return;
    }
    if (!form.restaurant_id) {
      toast.error('Ресторан сонгоно уу');
      return;
    }
    if (!form.price || Number(form.price) < 0) {
      toast.error('Үнэ зөв оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const body = {
        restaurant_id: form.restaurant_id,
        category_id: form.category_id || null,
        name: form.name.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        price: Number(form.price),
        discount_price: form.discount_price ? Number(form.discount_price) : null,
        preparation_minutes: form.preparation_minutes ? Number(form.preparation_minutes) : null,
        is_available: form.is_available,
      };
      if (editing) {
        await api(`/products/${editing.id}`, { method: 'PATCH', token, body });
        toast.success('Бүтээгдэхүүн шинэчлэгдлээ');
      } else {
        await api('/products', { method: 'POST', token, body });
        toast.success('Бүтээгдэхүүн нэмэгдлээ');
      }
      setOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailable = async (product: Product) => {
    try {
      await api(`/products/${product.id}`, {
        method: 'PATCH',
        token,
        body: { is_available: !product.is_available },
      });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (product: Product) => {
    try {
      await api(`/products/${product.id}`, { method: 'DELETE', token });
      toast.success('Бүтээгдэхүүн устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Бүтээгдэхүүн"
        description="Ресторан бүрийн цэс, үнэ, боломжит байдлыг удирдана."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Бүтээгдэхүүн нэмэх
          </Button>
        }
      />

      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Хоол хайх..."
              className="pl-9"
            />
          </div>
          <Select value={restaurantFilter} onValueChange={setRestaurantFilter}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Ресторан" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх ресторан</SelectItem>
              {restaurants.map((restaurant) => (
                <SelectItem key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Ангилал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх ангилал</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{products.length} бүтээгдэхүүн</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Бүтээгдэхүүн байхгүй"
              description="Шүүлтүүрээ өөрчил эсвэл шинэ хоол нэмээрэй."
              action={<Button onClick={openCreate}>Бүтээгдэхүүн нэмэх</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Хоол</TableHead>
                <TableHead>Ресторан</TableHead>
                <TableHead>Ангилал</TableHead>
                <TableHead>Үнэ</TableHead>
                <TableHead>Бэлэн</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted size-10 overflow-hidden rounded-lg">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">🍲</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{product.name}</p>
                        <p className="text-muted-foreground max-w-64 truncate text-xs">
                          {product.description ?? '—'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{product.restaurant_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">{product.category_name ?? '—'}</TableCell>
                  <TableCell className="text-sm">
                    <span className="font-medium">
                      {formatMoney(product.discount_price ?? product.price)}
                    </span>
                    {product.discount_price != null && product.discount_price < product.price && (
                      <span className="text-muted-foreground ml-1 line-through">
                        {formatMoney(product.price)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch checked={product.is_available} onCheckedChange={() => toggleAvailable(product)} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(product)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(product)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Бүтээгдэхүүн засах' : 'Бүтээгдэхүүн нэмэх'}</DialogTitle>
            <DialogDescription>Үнэ, ангилал, боломжит байдлыг тохируулна уу.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Нэр</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Ресторан</Label>
              <Select
                value={form.restaurant_id}
                onValueChange={(value) => setForm({ ...form, restaurant_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {restaurants.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Ангилал</Label>
              <Select
                value={form.category_id || 'none'}
                onValueChange={(value) => setForm({ ...form, category_id: value === 'none' ? '' : value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ангилалгүй</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Үнэ (₮)</Label>
              <Input
                type="number"
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хямдрал үнэ (₮)</Label>
              <Input
                type="number"
                value={form.discount_price}
                onChange={(event) => setForm({ ...form, discount_price: event.target.value })}
                placeholder="Хоосон бол хямдралгүй"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Бэлтгэх хугацаа (мин)</Label>
              <Input
                type="number"
                value={form.preparation_minutes}
                onChange={(event) => setForm({ ...form, preparation_minutes: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Зургийн URL</Label>
              <Input
                value={form.image_url}
                onChange={(event) => setForm({ ...form, image_url: event.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Тайлбар</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3 sm:col-span-2">
              <div>
                <Label>Боломжтой</Label>
                <p className="text-muted-foreground text-xs">Идэвхгүй бол хэрэглэгч захиалахгүй</p>
              </div>
              <Switch
                checked={form.is_available}
                onCheckedChange={(checked) => setForm({ ...form, is_available: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Цуцлах
            </Button>
            <Button onClick={save} disabled={saving}>
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title={`"${deleting?.name}"-г устгах уу?`}
        description="Энэ бүтээгдэхүүн цэснээс бүрэн устах болно."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
