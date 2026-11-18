'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronRight, Receipt, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderStatusBadge } from '@/components/status-badge';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import type { Order, Paginated } from '@/lib/types';
import { cn } from '@/lib/utils';

const FILTERS = [
  { value: 'all', label: 'Бүгд' },
  { value: 'pending,confirmed,preparing,ready,picked_up,delivering', label: 'Идэвхтэй' },
  { value: 'delivered', label: 'Хүргэгдсэн' },
  { value: 'cancelled', label: 'Цуцлагдсан' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await api<Paginated<Order>>(`/orders?${params.toString()}`, { token });
      setOrders(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filter]);

  const activeCount = useMemo(
    () =>
      orders.filter((order) =>
        ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering'].includes(
          order.status,
        ),
      ).length,
    [orders],
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Миний захиалга</h1>
          <p className="text-muted-foreground text-sm">
            {activeCount > 0 ? `${activeCount} идэвхтэй захиалга байна` : 'Захиалгын түүх'}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Сэргээх
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            className={cn(
              'cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              filter === option.value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-xl" />
          ))
        ) : orders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
              <div className="bg-muted flex size-16 items-center justify-center rounded-full text-2xl">
                🧾
              </div>
              <div>
                <p className="font-medium">Захиалга байхгүй байна</p>
                <p className="text-muted-foreground text-sm">
                  Анхны захиалгаа хийж энэ хэсгээс хянаарай.
                </p>
              </div>
              <Button asChild>
                <Link href="/">Ресторан үзэх</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          orders.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="block">
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                  <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-xl">
                    <Receipt className="text-muted-foreground size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">#{order.order_number}</span>
                      <OrderStatusBadge status={order.status} />
                      <span className="text-muted-foreground text-xs">
                        {formatDateTime(order.created_at)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-sm font-medium">{order.restaurant_name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {order.items?.map((item) => `${item.quantity}× ${item.product_name}`).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end">
                    <span className="font-semibold">{formatMoney(order.total_amount)}</span>
                    {order.payment?.payment_status === 'pending' && (
                      <Badge variant="warning">Төлбөр хүлээгдэж байна</Badge>
                    )}
                    <ChevronRight className="text-muted-foreground size-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
