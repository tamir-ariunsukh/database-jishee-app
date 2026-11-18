'use client';

import { useMemo, useState } from 'react';
import { Eye, RefreshCw, Search, XCircle } from 'lucide-react';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, PageHeader } from '@/components/admin/page-header';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/status-badge';
import { api, errorMessage } from '@/lib/api';
import {
  formatDateTime,
  formatMoney,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivering',
  'delivered',
  'cancelled',
];

export default function AdminOrdersPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const url = useMemo(() => {
    const params = new URLSearchParams({ limit: '100' });
    if (query) params.set('q', query);
    if (status !== 'all') params.set('status', status);
    return `/orders?${params.toString()}`;
  }, [query, status]);

  const { data: orders, loading, reload } = useList<Order>(url);

  const [detail, setDetail] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const openDetail = async (order: Order) => {
    setDetail(order);
    setDetailLoading(true);
    try {
      const res = await api<{ data: Order }>(`/orders/${order.id}`, { token });
      setDetail(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (nextStatus: string) => {
    if (!detail) return;
    setUpdating(true);
    try {
      const res = await api<{ data: Order }>(`/orders/${detail.id}/status`, {
        method: 'PATCH',
        token,
        body: { status: nextStatus },
      });
      setDetail(res.data);
      await reload();
      toast.success(`Төлөв "${ORDER_STATUS_LABELS[nextStatus]}" боллоо`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  const cancelOrder = async () => {
    if (!detail) return;
    setUpdating(true);
    try {
      const res = await api<{ data: Order }>(`/orders/${detail.id}/cancel`, {
        method: 'POST',
        token,
      });
      setDetail(res.data);
      await reload();
      toast.success('Захиалга цуцлагдлаа');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Захиалга"
        description="Бүх захиалгыг хянаж, төлөвийг шинэчилнэ."
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Сэргээх
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
              placeholder="Захиалгын дугаар эсвэл хэрэглэгч..."
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Төлөв" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх төлөв</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {ORDER_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{orders.length} захиалга</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Захиалга олдсонгүй" description="Шүүлтүүрээ өөрчилж үзээрэй." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">#</TableHead>
                <TableHead>Хэрэглэгч</TableHead>
                <TableHead>Ресторан</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Төлбөр</TableHead>
                <TableHead>Огноо</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="pl-4 font-medium">#{order.order_number}</TableCell>
                  <TableCell>
                    <p className="text-sm">{order.customer_name ?? '—'}</p>
                    <p className="text-muted-foreground text-xs">{order.customer_phone ?? ''}</p>
                  </TableCell>
                  <TableCell className="text-sm">{order.restaurant_name ?? '—'}</TableCell>
                  <TableCell>
                    <OrderStatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>
                    {order.payment ? (
                      <PaymentStatusBadge status={order.payment.payment_status} />
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(order.created_at)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatMoney(order.total_amount)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button variant="outline" size="sm" onClick={() => openDetail(order)}>
                      <Eye className="size-4" /> Харах
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={Boolean(detail)} onOpenChange={(open) => !open && setDetail(null)}>
        <DialogContent className="sm:max-w-2xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Захиалга #{detail.order_number}
                  <OrderStatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  {detail.customer_name ?? 'Хэрэглэгч'} · {formatDateTime(detail.created_at)}
                </DialogDescription>
              </DialogHeader>

              {detailLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Ресторан</p>
                      <p className="font-medium">{detail.restaurant_name ?? '—'}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground text-xs">Хаяг</p>
                      <p className="font-medium">{detail.address_text ?? '—'}</p>
                      {(detail.apartment || detail.entrance || detail.floor) && (
                        <p className="text-muted-foreground text-xs">
                          {[
                            detail.apartment && `Тоот ${detail.apartment}`,
                            detail.entrance && `Орц ${detail.entrance}`,
                            detail.floor && `Давхар ${detail.floor}`,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 rounded-lg border p-3 text-sm">
                    {detail.items?.map((item) => (
                      <div key={item.id} className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">
                            {item.quantity}× {item.product_name}
                          </p>
                          {item.selected_options?.length > 0 && (
                            <p className="text-muted-foreground text-xs">
                              {item.selected_options.map((option) => option.name).join(', ')}
                            </p>
                          )}
                        </div>
                        <span>{formatMoney(item.total_price)}</span>
                      </div>
                    ))}
                    <Separator />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Хоолны дүн</span>
                      <span>{formatMoney(detail.subtotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Хүргэлт</span>
                      <span>{formatMoney(detail.delivery_fee)}</span>
                    </div>
                    {detail.discount_amount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Хямдрал</span>
                        <span>−{formatMoney(detail.discount_amount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold">
                      <span>Нийт</span>
                      <span>{formatMoney(detail.total_amount)}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <Badge variant="outline">
                      {PAYMENT_METHOD_LABELS[detail.payment?.payment_method ?? ''] ?? 'Төлбөр'}
                    </Badge>
                    {detail.payment && <PaymentStatusBadge status={detail.payment.payment_status} />}
                    {detail.customer_note && (
                      <span className="text-muted-foreground text-xs">“{detail.customer_note}”</span>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label>Төлөв шинэчлэх</Label>
                    <Select value={detail.status} onValueChange={updateStatus} disabled={updating}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((option) => (
                          <SelectItem key={option} value={option}>
                            {ORDER_STATUS_LABELS[option]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <DialogFooter>
                {['pending', 'confirmed'].includes(detail.status) && (
                  <Button variant="outline" className="text-destructive" onClick={cancelOrder} disabled={updating}>
                    <XCircle className="size-4" /> Цуцлах
                  </Button>
                )}
                <Button variant="secondary" onClick={() => setDetail(null)}>
                  Хаах
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
