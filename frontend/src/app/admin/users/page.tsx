'use client';

import { useMemo, useState } from 'react';
import { Search, Trash2, UserCog } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
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
import { formatDate, formatMoney, ROLE_LABELS } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { AdminUser, Role } from '@/lib/types';

export default function AdminUsersPage() {
  const { token, user: currentUser } = useAuth();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState('all');

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (query) params.set('q', query);
    if (role !== 'all') params.set('role', role);
    return `/admin/users?${params.toString()}`;
  }, [query, role]);

  const { data: users, loading, reload } = useList<AdminUser>(url);
  const [deleting, setDeleting] = useState<AdminUser | null>(null);

  const changeRole = async (target: AdminUser, nextRole: Role) => {
    try {
      await api(`/admin/users/${target.id}/role`, {
        method: 'PATCH',
        token,
        body: { role: nextRole },
      });
      toast.success(`Эрх "${ROLE_LABELS[nextRole]}" боллоо`);
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const remove = async (target: AdminUser) => {
    try {
      await api(`/admin/users/${target.id}`, { method: 'DELETE', token });
      toast.success('Хэрэглэгч устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div>
      <PageHeader
        title="Хэрэглэгчид"
        description="Бүртгэлтэй хэрэглэгч, эрх, захиалгын үзүүлэлт."
      />

      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Нэр, и-мэйл, утас..."
              className="pl-9"
            />
          </div>
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Эрх" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх эрх</SelectItem>
              <SelectItem value="customer">Хэрэглэгч</SelectItem>
              <SelectItem value="admin">Админ</SelectItem>
              <SelectItem value="driver">Хүргэгч</SelectItem>
            </SelectContent>
          </Select>
          <Badge variant="secondary">{users.length} хэрэглэгч</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Хэрэглэгч олдсонгүй" description="Шүүлтүүрээ өөрчилж үзээрэй." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Хэрэглэгч</TableHead>
                <TableHead>Утас</TableHead>
                <TableHead>Эрх</TableHead>
                <TableHead className="text-center">Захиалга</TableHead>
                <TableHead className="text-right">Зарцуулалт</TableHead>
                <TableHead>Бүртгэгдсэн</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="pl-4">
                    <p className="font-medium">{item.full_name ?? '—'}</p>
                    <p className="text-muted-foreground text-xs">{item.email}</p>
                  </TableCell>
                  <TableCell className="text-sm">{item.phone ?? '—'}</TableCell>
                  <TableCell className="min-w-36">
                    <Select
                      value={item.role}
                      onValueChange={(value) => changeRole(item, value as Role)}
                      disabled={item.id === currentUser?.id}
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="customer">Хэрэглэгч</SelectItem>
                        <SelectItem value="admin">Админ</SelectItem>
                        <SelectItem value="driver">Хүргэгч</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center">{item.order_count}</TableCell>
                  <TableCell className="text-right">{formatMoney(item.total_spent)}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDate(item.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      disabled={item.id === currentUser?.id}
                      onClick={() => setDeleting(item)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title={`"${deleting?.full_name ?? deleting?.email}"-г устгах уу?`}
        description="Хэрэглэгчийн бүртгэл, хаяг, сагс хамт устах болно."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
