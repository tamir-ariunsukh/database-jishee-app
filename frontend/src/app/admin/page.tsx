'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Bike,
  CircleDollarSign,
  Clock,
  Receipt,
  RefreshCw,
  Star,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/admin/page-header';
import { OrderStatusBadge } from '@/components/status-badge';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import type { AdminStats } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-sky-500',
  preparing: 'bg-indigo-500',
  ready: 'bg-violet-500',
  picked_up: 'bg-cyan-500',
  delivering: 'bg-blue-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-rose-500',
};

export default function AdminDashboardPage() {
  const { token } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: AdminStats }>('/admin/stats', { token });
      setStats(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const maxRevenue = useMemo(
    () => Math.max(1, ...(stats?.revenue_series.map((point) => Number(point.revenue)) ?? [1])),
    [stats],
  );

  const cards = stats
    ? [
        {
          label: 'Нийт орлого',
          value: formatMoney(stats.summary.total_revenue),
          hint: `Өнөөдөр ${formatMoney(stats.summary.revenue_today)}`,
          icon: CircleDollarSign,
          tone: 'text-emerald-600 bg-emerald-500/15',
        },
        {
          label: 'Захиалга',
          value: stats.summary.total_orders,
          hint: `Өнөөдөр ${stats.summary.orders_today}`,
          icon: Receipt,
          tone: 'text-sky-600 bg-sky-500/15',
        },
        {
          label: 'Идэвхтэй захиалга',
          value: stats.summary.active_orders,
          hint: 'Хүргэгдээгүй, цуцлагдаагүй',
          icon: Clock,
          tone: 'text-amber-600 bg-amber-500/15',
        },
        {
          label: 'Хэрэглэгчид',
          value: stats.summary.total_customers,
          hint: `${stats.summary.active_restaurants} идэвхтэй ресторан`,
          icon: Users,
          tone: 'text-violet-600 bg-violet-500/15',
        },
      ]
    : [];

  return (
    <div>
      <PageHeader
        title="Хяналтын самбар"
        description="Бизнесийн үндсэн үзүүлэлтүүд, сүүлийн захиалгууд."
        actions={
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Сэргээх
          </Button>
        }
      />

      {loading || !stats ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-80 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.label} className="py-5">
                <CardContent className="flex items-start justify-between px-5">
                  <div>
                    <p className="text-muted-foreground text-sm">{card.label}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight">{card.value}</p>
                    <p className="text-muted-foreground mt-1 text-xs">{card.hint}</p>
                  </div>
                  <div className={cn('flex size-10 items-center justify-center rounded-lg', card.tone)}>
                    <card.icon className="size-5" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Revenue chart */}
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <TrendingUp className="text-primary size-4" /> 14 хоногийн орлого
                </CardTitle>
                <Badge variant="secondary">
                  <Star className="mr-1 size-3 fill-amber-400 text-amber-400" />
                  {Number(stats.summary.avg_rating).toFixed(1)} дундаж үнэлгээ
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="flex h-56 items-end gap-1.5">
                  {stats.revenue_series.map((point) => {
                    const height = Math.max(3, (Number(point.revenue) / maxRevenue) * 100);
                    return (
                      <div key={point.day} className="group flex flex-1 flex-col items-center gap-1">
                        <div className="relative flex w-full flex-1 items-end">
                          <div
                            className="bg-primary/80 group-hover:bg-primary w-full rounded-t transition-all"
                            style={{ height: `${height}%` }}
                            title={`${point.day}: ${formatMoney(point.revenue)} (${point.orders} захиалга)`}
                          />
                        </div>
                        <span className="text-muted-foreground text-[10px]">
                          {point.day.slice(5)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="text-muted-foreground mt-3 flex items-center justify-between text-xs">
                  <span>Хамгийн өндөр: {formatMoney(maxRevenue)}</span>
                  <span>Нийт {stats.revenue_series.reduce((sum, p) => sum + Number(p.orders), 0)} захиалга</span>
                </div>
              </CardContent>
            </Card>

            {/* Status breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Захиалгын төлөв</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.status_counts.length === 0 && (
                  <p className="text-muted-foreground text-sm">Мэдээлэл байхгүй</p>
                )}
                {(() => {
                  const total = stats.status_counts.reduce((sum, item) => sum + Number(item.count), 0) || 1;
                  return stats.status_counts.map((item) => (
                    <div key={item.status} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{ORDER_STATUS_LABELS[item.status] ?? item.status}</span>
                        <span className="text-muted-foreground">{item.count}</span>
                      </div>
                      <div className="bg-muted h-2 overflow-hidden rounded-full">
                        <div
                          className={cn('h-full rounded-full', STATUS_COLORS[item.status] ?? 'bg-primary')}
                          style={{ width: `${(Number(item.count) / total) * 100}%` }}
                        />
                      </div>
                    </div>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Store className="text-primary size-4" /> Шилдэг ресторанууд
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.top_restaurants.map((restaurant, index) => (
                  <div key={restaurant.id} className="flex items-center gap-3">
                    <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{restaurant.name}</p>
                      <p className="text-muted-foreground text-xs">{restaurant.orders} захиалга</p>
                    </div>
                    <span className="text-sm font-medium">{formatMoney(restaurant.revenue)}</span>
                  </div>
                ))}
                {stats.top_restaurants.length === 0 && (
                  <p className="text-muted-foreground text-sm">Мэдээлэл байхгүй</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Bike className="text-primary size-4" /> Шилдэг бүтээгдэхүүн
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.top_products.map((product, index) => (
                  <div key={product.product_name} className="flex items-center gap-3">
                    <span className="bg-muted flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{product.product_name}</p>
                      <p className="text-muted-foreground text-xs">{product.sold} ширхэг</p>
                    </div>
                    <span className="text-sm font-medium">{formatMoney(product.revenue)}</span>
                  </div>
                ))}
                {stats.top_products.length === 0 && (
                  <p className="text-muted-foreground text-sm">Мэдээлэл байхгүй</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-base">Сүүлийн захиалга</CardTitle>
                <Link
                  href="/admin/orders"
                  className="text-primary flex items-center gap-1 text-xs font-medium hover:underline"
                >
                  Бүгд <ArrowUpRight className="size-3" />
                </Link>
              </CardHeader>
              <CardContent className="space-y-2">
                {stats.recent_orders.slice(0, 6).map((order) => (
                  <div key={order.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">#{order.order_number}</p>
                      <p className="text-muted-foreground truncate text-xs">
                        {order.customer_name ?? 'Хэрэглэгч'} · {formatDateTime(order.created_at)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Захиалгын жагсаалт</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">#</TableHead>
                    <TableHead>Хэрэглэгч</TableHead>
                    <TableHead>Ресторан</TableHead>
                    <TableHead>Төлөв</TableHead>
                    <TableHead>Огноо</TableHead>
                    <TableHead className="pr-6 text-right">Дүн</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.recent_orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="pl-6 font-medium">#{order.order_number}</TableCell>
                      <TableCell>{order.customer_name ?? '—'}</TableCell>
                      <TableCell>{order.restaurant_name ?? '—'}</TableCell>
                      <TableCell>
                        <OrderStatusBadge status={order.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {formatDateTime(order.created_at)}
                      </TableCell>
                      <TableCell className="pr-6 text-right font-medium">
                        {formatMoney(order.total_amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
