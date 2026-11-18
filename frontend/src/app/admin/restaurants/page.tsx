'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Star, Trash2 } from 'lucide-react';
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
import type { Paginated, Restaurant } from '@/lib/types';

interface FormState {
  name: string;
  description: string;
  logo_url: string;
  cover_url: string;
  phone: string;
  address: string;
  delivery_fee: string;
  min_order_amount: string;
  estimated_delivery_minutes: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  name: '',
  description: '',
  logo_url: '',
  cover_url: '',
  phone: '',
  address: '',
  delivery_fee: '3000',
  min_order_amount: '15000',
  estimated_delivery_minutes: '30',
  is_active: true,
};

export default function AdminRestaurantsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const url = useMemo(
    () => `/restaurants?limit=100&is_active=all${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    [query],
  );
  const { data, loading, reload } = useList<Restaurant>(url);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Restaurant | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (restaurant: Restaurant) => {
    setEditing(restaurant);
    setForm({
      name: restaurant.name,
      description: restaurant.description ?? '',
      logo_url: restaurant.logo_url ?? '',
      cover_url: restaurant.cover_url ?? '',
      phone: restaurant.phone ?? '',
      address: restaurant.address ?? '',
      delivery_fee: String(restaurant.delivery_fee ?? 0),
      min_order_amount: String(restaurant.min_order_amount ?? 0),
      estimated_delivery_minutes: String(restaurant.estimated_delivery_minutes ?? 30),
      is_active: restaurant.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Рестораны нэр оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        logo_url: form.logo_url.trim() || null,
        cover_url: form.cover_url.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        delivery_fee: Number(form.delivery_fee) || 0,
        min_order_amount: Number(form.min_order_amount) || 0,
        estimated_delivery_minutes: Number(form.estimated_delivery_minutes) || null,
        is_active: form.is_active,
      };
      if (editing) {
        await api(`/restaurants/${editing.id}`, { method: 'PATCH', token, body });
        toast.success('Ресторан шинэчлэгдлээ');
      } else {
        await api('/restaurants', { method: 'POST', token, body });
        toast.success('Ресторан нэмэгдлээ');
      }
      setOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (restaurant: Restaurant) => {
    try {
      await api(`/restaurants/${restaurant.id}`, {
        method: 'PATCH',
        token,
        body: { is_active: !restaurant.is_active },
      });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (restaurant: Restaurant) => {
    try {
      await api(`/restaurants/${restaurant.id}`, { method: 'DELETE', token });
      toast.success('Ресторан устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const rows = data;

  return (
    <div>
      <PageHeader
        title="Ресторан"
        description="Ресторан, хүргэлтийн нөхцөл, ажиллах төлөвийг удирдана."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Ресторан нэмэх
          </Button>
        }
      />

      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ресторан хайх..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{rows.length} ресторан</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Ресторан байхгүй"
              description="Эхний ресторанаа нэмээрэй."
              action={<Button onClick={openCreate}>Ресторан нэмэх</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Ресторан</TableHead>
                <TableHead>Холбоо барих</TableHead>
                <TableHead>Хүргэлт</TableHead>
                <TableHead>Мин. захиалга</TableHead>
                <TableHead>Үнэлгээ</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((restaurant) => (
                <TableRow key={restaurant.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted size-10 overflow-hidden rounded-lg">
                        {restaurant.cover_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={restaurant.cover_url}
                            alt={restaurant.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center">🍽️</div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium">{restaurant.name}</p>
                        <p className="text-muted-foreground max-w-56 truncate text-xs">
                          {restaurant.address ?? '—'}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{restaurant.phone ?? '—'}</TableCell>
                  <TableCell className="text-sm">{formatMoney(restaurant.delivery_fee)}</TableCell>
                  <TableCell className="text-sm">{formatMoney(restaurant.min_order_amount)}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1 text-sm">
                      <Star className="size-3.5 fill-amber-400 text-amber-400" />
                      {Number(restaurant.avg_rating ?? 0).toFixed(1)}
                      <span className="text-muted-foreground">({restaurant.review_count ?? 0})</span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Switch checked={restaurant.is_active} onCheckedChange={() => toggleActive(restaurant)} />
                      <span className="text-muted-foreground text-xs">
                        {restaurant.is_active ? 'Идэвхтэй' : 'Хаалттай'}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(restaurant)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(restaurant)}
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
            <DialogTitle>{editing ? 'Ресторан засах' : 'Ресторан нэмэх'}</DialogTitle>
            <DialogDescription>Үндсэн мэдээлэл, хүргэлтийн нөхцөлийг бөглөнө үү.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Нэр</Label>
              <Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Тайлбар</Label>
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Утас</Label>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Хаяг</Label>
              <Input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Нүүр зургийн URL</Label>
              <Input
                value={form.cover_url}
                onChange={(event) => setForm({ ...form, cover_url: event.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Лого URL</Label>
              <Input
                value={form.logo_url}
                onChange={(event) => setForm({ ...form, logo_url: event.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хүргэлтийн төлбөр (₮)</Label>
              <Input
                type="number"
                value={form.delivery_fee}
                onChange={(event) => setForm({ ...form, delivery_fee: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Доод захиалга (₮)</Label>
              <Input
                type="number"
                value={form.min_order_amount}
                onChange={(event) => setForm({ ...form, min_order_amount: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хүргэлтийн хугацаа (мин)</Label>
              <Input
                type="number"
                value={form.estimated_delivery_minutes}
                onChange={(event) =>
                  setForm({ ...form, estimated_delivery_minutes: event.target.value })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Идэвхтэй</Label>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
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
        title={`"${deleting?.name}" рестораныг устгах уу?`}
        description="Ресторан, түүний цэс, хүргэлтийн хуваарь хамт устах болно."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
