'use client';

import { useMemo, useState } from 'react';
import { Pencil, Plus, Search, Ticket, Trash2 } from 'lucide-react';
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
import { formatDate, formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Coupon } from '@/lib/types';

interface FormState {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  min_order_amount: string;
  max_discount: string;
  starts_at: string;
  expires_at: string;
  usage_limit: string;
  is_active: boolean;
}

const EMPTY: FormState = {
  code: '',
  discount_type: 'percentage',
  discount_value: '10',
  min_order_amount: '0',
  max_discount: '',
  starts_at: '',
  expires_at: '',
  usage_limit: '',
  is_active: true,
};

const toLocalInput = (value: string | null) => (value ? new Date(value).toISOString().slice(0, 16) : '');

export default function AdminCouponsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const url = useMemo(
    () => `/coupons?limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    [query],
  );
  const { data: coupons, loading, reload } = useList<Coupon>(url);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (coupon: Coupon) => {
    setEditing(coupon);
    setForm({
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: String(coupon.discount_value),
      min_order_amount: String(coupon.min_order_amount ?? 0),
      max_discount: coupon.max_discount != null ? String(coupon.max_discount) : '',
      starts_at: toLocalInput(coupon.starts_at),
      expires_at: toLocalInput(coupon.expires_at),
      usage_limit: coupon.usage_limit != null ? String(coupon.usage_limit) : '',
      is_active: coupon.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.code.trim()) {
      toast.error('Купон код оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        min_order_amount: Number(form.min_order_amount) || 0,
        max_discount: form.max_discount ? Number(form.max_discount) : null,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
        is_active: form.is_active,
      };
      if (editing) {
        await api(`/coupons/${editing.id}`, { method: 'PATCH', token, body });
        toast.success('Купон шинэчлэгдлээ');
      } else {
        await api('/coupons', { method: 'POST', token, body });
        toast.success('Купон нэмэгдлээ');
      }
      setOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      await api(`/coupons/${coupon.id}`, {
        method: 'PATCH',
        token,
        body: { is_active: !coupon.is_active },
      });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (coupon: Coupon) => {
    try {
      await api(`/coupons/${coupon.id}`, { method: 'DELETE', token });
      toast.success('Купон устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Купон"
        description="Хямдралын код, хязгаар, хугацааг удирдана."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Купон нэмэх
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
              placeholder="Код хайх..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{coupons.length} купон</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : coupons.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<Ticket className="size-5" />}
              title="Купон байхгүй"
              description="Шинэ хямдралын код үүсгээрэй."
              action={<Button onClick={openCreate}>Купон нэмэх</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Код</TableHead>
                <TableHead>Хямдрал</TableHead>
                <TableHead>Доод дүн</TableHead>
                <TableHead>Хязгаар</TableHead>
                <TableHead>Хугацаа</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {coupons.map((coupon) => (
                <TableRow key={coupon.id}>
                  <TableCell className="pl-4 font-medium">{coupon.code}</TableCell>
                  <TableCell className="text-sm">
                    {coupon.discount_type === 'percentage'
                      ? `${coupon.discount_value}%`
                      : formatMoney(coupon.discount_value)}
                    {coupon.max_discount != null && (
                      <span className="text-muted-foreground"> (max {formatMoney(coupon.max_discount)})</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{formatMoney(coupon.min_order_amount)}</TableCell>
                  <TableCell className="text-sm">{coupon.usage_limit ?? '∞'}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(coupon.starts_at)} → {formatDate(coupon.expires_at)}
                  </TableCell>
                  <TableCell>
                    <Switch checked={coupon.is_active} onCheckedChange={() => toggleActive(coupon)} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(coupon)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(coupon)}
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
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing ? 'Купон засах' : 'Купон нэмэх'}</DialogTitle>
            <DialogDescription>Кодын үсэг автоматаар том болно.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Код</Label>
              <Input
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
                placeholder="WELCOME10"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хямдралын төрөл</Label>
              <Select
                value={form.discount_type}
                onValueChange={(value) =>
                  setForm({ ...form, discount_type: value as 'percentage' | 'fixed' })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Хувь (%)</SelectItem>
                  <SelectItem value="fixed">Тогтмол (₮)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Утга</Label>
              <Input
                type="number"
                value={form.discount_value}
                onChange={(event) => setForm({ ...form, discount_value: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Доод дүн (₮)</Label>
              <Input
                type="number"
                value={form.min_order_amount}
                onChange={(event) => setForm({ ...form, min_order_amount: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хамгийн их хямдрал (₮)</Label>
              <Input
                type="number"
                value={form.max_discount}
                onChange={(event) => setForm({ ...form, max_discount: event.target.value })}
                placeholder="Хязгааргүй бол хоосон"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Эхлэх огноо</Label>
              <Input
                type="datetime-local"
                value={form.starts_at}
                onChange={(event) => setForm({ ...form, starts_at: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Дуустах огноо</Label>
              <Input
                type="datetime-local"
                value={form.expires_at}
                onChange={(event) => setForm({ ...form, expires_at: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Ашиглах хязгаар</Label>
              <Input
                type="number"
                value={form.usage_limit}
                onChange={(event) => setForm({ ...form, usage_limit: event.target.value })}
                placeholder="Хязгааргүй бол хоосон"
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
        title={`"${deleting?.code}" купоныг устгах уу?`}
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
