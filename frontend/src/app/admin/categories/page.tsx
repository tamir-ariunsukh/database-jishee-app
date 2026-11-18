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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Category } from '@/lib/types';

const EMPTY = { name: '', image_url: '', sort_order: '0', is_active: true };

export default function AdminCategoriesPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const url = useMemo(
    () => `/categories?limit=100${query ? `&q=${encodeURIComponent(query)}` : ''}`,
    [query],
  );
  const { data, loading, reload } = useList<Category>(url);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Category | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditing(category);
    setForm({
      name: category.name,
      image_url: category.image_url ?? '',
      sort_order: String(category.sort_order),
      is_active: category.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) {
      toast.error('Ангилалын нэр оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        image_url: form.image_url.trim() || null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editing) {
        await api(`/categories/${editing.id}`, { method: 'PATCH', token, body });
        toast.success('Ангилал шинэчлэгдлээ');
      } else {
        await api('/categories', { method: 'POST', token, body });
        toast.success('Ангилал нэмэгдлээ');
      }
      setOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (category: Category) => {
    try {
      await api(`/categories/${category.id}`, { method: 'DELETE', token });
      toast.success('Ангилал устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Ангилал"
        description="Хоолны ангилалуудыг эрэмбэлж, идэвхжүүлнэ."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Ангилал нэмэх
          </Button>
        }
      />

      <Card className="py-0">
        <div className="flex items-center gap-2 border-b p-3">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ангилал хайх..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{data.length} ангилал</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Ангилал байхгүй"
              description="Эхний ангилалаа нэмээрэй."
              action={<Button onClick={openCreate}>Ангилал нэмэх</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Нэр</TableHead>
                <TableHead>Эрэмбэ</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((category) => (
                <TableRow key={category.id}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <div className="bg-muted size-9 overflow-hidden rounded-md">
                        {category.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={category.image_url}
                            alt={category.name}
                            className="size-full object-cover"
                          />
                        ) : (
                          <div className="flex size-full items-center justify-center text-sm">🍽️</div>
                        )}
                      </div>
                      <span className="font-medium">{category.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{category.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={category.is_active ? 'success' : 'secondary'}>
                      {category.is_active ? 'Идэвхтэй' : 'Идэвхгүй'}
                    </Badge>
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(category)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(category)}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Ангилал засах' : 'Ангилал нэмэх'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Нэр</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Бургер"
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
            <div className="space-y-1.5">
              <Label>Эрэмбэ</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(event) => setForm({ ...form, sort_order: event.target.value })}
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
        title={`"${deleting?.name}" ангилалыг устгах уу?`}
        description="Энэ ангилалд хамаарах бүтээгдэхүүнүүд ангилалгүй болно."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
