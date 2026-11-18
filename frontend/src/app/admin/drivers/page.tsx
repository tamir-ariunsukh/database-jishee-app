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
import type { Driver } from '@/lib/types';

const EMPTY = { email: '', password: '', full_name: '', phone: '' };

export default function AdminDriversPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const url = useMemo(
    () => `/drivers${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    [query],
  );
  const { data: drivers, loading, reload } = useList<Driver>(url);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Driver | null>(null);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setOpen(true);
  };

  const openEdit = (driver: Driver) => {
    setEditing(driver);
    setForm({ email: driver.email, password: '', full_name: driver.full_name ?? '', phone: driver.phone ?? '' });
    setOpen(true);
  };

  const save = async () => {
    if (!form.full_name.trim()) {
      toast.error('Нэр оруулна уу');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/drivers/${editing.id}`, {
          method: 'PATCH',
          token,
          body: { full_name: form.full_name.trim(), phone: form.phone.trim() || null },
        });
        toast.success('Хүргэгч шинэчлэгдлээ');
      } else {
        if (!form.email.trim() || form.password.length < 6) {
          toast.error('И-мэйл болон 6+ тэмдэгт нууц үг оруулна уу');
          setSaving(false);
          return;
        }
        await api('/drivers', {
          method: 'POST',
          token,
          body: {
            email: form.email.trim(),
            password: form.password,
            full_name: form.full_name.trim(),
            phone: form.phone.trim() || null,
          },
        });
        toast.success('Хүргэгч бүртгэгдлээ');
      }
      setOpen(false);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (driver: Driver) => {
    try {
      await api(`/drivers/${driver.id}`, {
        method: 'PATCH',
        token,
        body: { is_available: !driver.is_available },
      });
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (driver: Driver) => {
    try {
      await api(`/drivers/${driver.id}`, { method: 'DELETE', token });
      toast.success('Хүргэгч устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Хүргэгчид"
        description="Хүргэгчийн бүртгэл, бэлэн байдлыг удирдана."
        actions={
          <Button onClick={openCreate}>
            <Plus className="size-4" /> Хүргэгч нэмэх
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
              placeholder="Нэр, утас, и-мэйл..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{drivers.length} хүргэгч</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : drivers.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="Хүргэгч байхгүй"
              description="Шинэ хүргэгч бүртгээрэй."
              action={<Button onClick={openCreate}>Хүргэгч нэмэх</Button>}
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Хүргэгч</TableHead>
                <TableHead>Холбоо барих</TableHead>
                <TableHead className="text-center">Идэвхтэй</TableHead>
                <TableHead className="text-center">Дууссан</TableHead>
                <TableHead>Бэлэн</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map((driver) => (
                <TableRow key={driver.id}>
                  <TableCell className="pl-4 font-medium">{driver.full_name ?? '—'}</TableCell>
                  <TableCell>
                    <p className="text-sm">{driver.phone ?? '—'}</p>
                    <p className="text-muted-foreground text-xs">{driver.email}</p>
                  </TableCell>
                  <TableCell className="text-center">{driver.active_deliveries}</TableCell>
                  <TableCell className="text-center">{driver.completed_deliveries}</TableCell>
                  <TableCell>
                    <Switch checked={driver.is_available} onCheckedChange={() => toggleAvailability(driver)} />
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" onClick={() => openEdit(driver)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleting(driver)}
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
            <DialogTitle>{editing ? 'Хүргэгч засах' : 'Хүргэгч нэмэх'}</DialogTitle>
            <DialogDescription>
              {editing
                ? 'Хүргэгчийн мэдээллийг шинэчилнэ.'
                : 'Хүргэгч апп-д нэвтрэх бүртгэл үүсгэнэ.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Овог нэр</Label>
              <Input
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Утас</Label>
              <Input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            {!editing && (
              <>
                <div className="space-y-1.5">
                  <Label>И-мэйл</Label>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Нууц үг</Label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                  />
                </div>
              </>
            )}
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
        title={`"${deleting?.full_name}"-г устгах уу?`}
        description="Хүргэгчийн нэвтрэх бүртгэл хамт устах болно."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
