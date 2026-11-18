'use client';

import { useMemo, useState } from 'react';
import { Bike, CheckCircle2, MapPin, Package, Phone, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { EmptyState, PageHeader } from '@/components/admin/page-header';
import { DeliveryStatusBadge } from '@/components/status-badge';
import { api, errorMessage } from '@/lib/api';
import { DELIVERY_STATUS_LABELS, formatDateTime, formatMoney } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Delivery, Driver } from '@/lib/types';
import { cn } from '@/lib/utils';

const STATUS_OPTIONS = ['waiting', 'assigned', 'picked_up', 'delivering', 'delivered', 'cancelled'];

export default function AdminDeliveriesPage() {
  const { user, token } = useAuth();
  const isDriver = user?.role === 'driver';
  const [status, setStatus] = useState('all');

  const url = useMemo(() => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    const qs = params.toString();
    return `/deliveries${qs ? `?${qs}` : ''}`;
  }, [status]);

  const { data: deliveries, loading, reload } = useList<Delivery>(url);
  const { data: drivers } = useList<Driver>(isDriver ? null : '/drivers');
  const { data: available, reload: reloadAvailable } = useList<Delivery>(
    isDriver ? '/deliveries/available' : null,
  );

  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const patch = async (id: string, body: Record<string, unknown>) => {
    setUpdatingId(id);
    try {
      await api(`/deliveries/${id}`, { method: 'PATCH', token, body });
      await reload();
      await reloadAvailable();
      toast.success('Хүргэлт шинэчлэгдлээ');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  const claim = async (id: string) => {
    setUpdatingId(id);
    try {
      await api(`/deliveries/${id}/claim`, { method: 'POST', token });
      await reload();
      await reloadAvailable();
      toast.success('Хүргэлтийг хүлээн авлаа');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title={isDriver ? 'Миний хүргэлт' : 'Хүргэлт'}
        description={
          isDriver
            ? 'Танд хуваарилагдсан хүргэлтүүд. Төлөвийг шинэчилж ажиллаарай.'
            : 'Хүргэлтийг хүргэгчид хуваарилж, явцыг хянана.'
        }
        actions={
          <Button variant="outline" size="sm" onClick={reload} disabled={loading}>
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} /> Сэргээх
          </Button>
        }
      />

      {isDriver && (
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Package className="text-primary size-4" /> Боломжтой хүргэлтүүд
              <Badge variant="secondary">{available.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {available.length === 0 ? (
              <p className="text-muted-foreground text-sm">Одоогоор боломжтой хүргэлт байхгүй.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {available.map((delivery) => (
                  <div key={delivery.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">#{delivery.order_number}</span>
                      <span className="font-semibold">{formatMoney(delivery.total_amount ?? 0)}</span>
                    </div>
                    <p className="text-muted-foreground mt-1 flex items-center gap-1 text-xs">
                      <MapPin className="size-3" /> {delivery.restaurant_name}
                    </p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      → {delivery.address_text ?? '—'}
                    </p>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => claim(delivery.id)}
                      disabled={updatingId === delivery.id}
                    >
                      <Bike className="size-4" /> Хүлээн авах
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Төлөв" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх төлөв</SelectItem>
              {STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {DELIVERY_STATUS_LABELS[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Badge variant="secondary">{deliveries.length} хүргэлт</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : deliveries.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Хүргэлт байхгүй" description="Шүүлтүүрээ өөрчилж үзээрэй." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Захиалга</TableHead>
                <TableHead>Ресторан → Хаяг</TableHead>
                <TableHead>Хэрэглэгч</TableHead>
                {!isDriver && <TableHead>Хүргэгч</TableHead>}
                <TableHead>Төлөв</TableHead>
                <TableHead>Огноо</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell className="pl-4 font-medium">#{delivery.order_number}</TableCell>
                  <TableCell>
                    <p className="text-sm">{delivery.restaurant_name ?? '—'}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="size-3" /> {delivery.address_text ?? '—'}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm">{delivery.customer_name ?? '—'}</p>
                    {delivery.customer_phone && (
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Phone className="size-3" /> {delivery.customer_phone}
                      </p>
                    )}
                  </TableCell>
                  {!isDriver && (
                    <TableCell className="min-w-44">
                      <Select
                        value={delivery.driver_id ?? 'none'}
                        onValueChange={(value) =>
                          patch(delivery.id, { driver_id: value === 'none' ? null : value, status: value === 'none' ? 'waiting' : 'assigned' })
                        }
                        disabled={updatingId === delivery.id}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Хуваарилах" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Хуваарилаагүй</SelectItem>
                          {drivers.map((driver) => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.full_name ?? driver.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  )}
                  <TableCell>
                    <DeliveryStatusBadge status={delivery.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(delivery.created_at)}
                  </TableCell>
                  <TableCell className="pr-4">
                    <div className="flex justify-end gap-2">
                      {delivery.status !== 'delivered' && delivery.status !== 'cancelled' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === delivery.id}
                          onClick={() =>
                            patch(delivery.id, {
                              status: delivery.status === 'delivering' ? 'delivered' : 'delivering',
                            })
                          }
                        >
                          <CheckCircle2 className="size-4" />
                          {delivery.status === 'delivering' ? 'Хүргэсэн' : 'Хүргэж эхлэх'}
                        </Button>
                      )}
                      {delivery.status === 'delivered' && (
                        <Badge variant="success">Дууссан</Badge>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
