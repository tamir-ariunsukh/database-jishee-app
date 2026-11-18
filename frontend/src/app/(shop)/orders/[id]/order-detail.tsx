'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  CreditCard,
  MapPin,
  MessageSquare,
  Phone,
  Star,
  Truck,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { OrderStatusBadge, PaymentStatusBadge } from '@/components/status-badge';
import { api, errorMessage } from '@/lib/api';
import {
  DELIVERY_STATUS_LABELS,
  formatDateTime,
  formatMoney,
  ORDER_STATUS_FLOW,
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@/lib/format';
import { useAuth } from '@/lib/providers';
import type { Order } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const load = useCallback(async () => {
    if (!token || !params.id) return;
    setLoading(true);
    try {
      const res = await api<{ data: Order }>(`/orders/${params.id}`, { token });
      setOrder(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token, params.id]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const cancelOrder = async () => {
    if (!order) return;
    setActing(true);
    try {
      await api(`/orders/${order.id}/cancel`, { method: 'POST', token });
      toast.success('Захиалга цуцлагдлаа');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setActing(false);
    }
  };

  const payNow = async () => {
    if (!order) return;
    setActing(true);
    try {
      await api(`/payments/orders/${order.id}/pay`, {
        method: 'POST',
        token,
        body: { payment_method: order.payment?.payment_method ?? 'card' },
      });
      toast.success('Төлбөр амжилттай төлөгдлөө');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setActing(false);
    }
  };

  const submitReview = async () => {
    if (!order) return;
    setActing(true);
    try {
      await api('/reviews', {
        method: 'POST',
        token,
        body: { order_id: order.id, rating, comment: comment.trim() || null },
      });
      toast.success('Үнэлгээ өгсөнд баярлалаа!');
      setReviewOpen(false);
      setComment('');
      await load();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setActing(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-lg font-medium">Захиалга олдсонгүй</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/orders">Захиалгууд руу буцах</Link>
        </Button>
      </div>
    );
  }

  const isCancelled = order.status === 'cancelled';
  const currentIndex = ORDER_STATUS_FLOW.indexOf(order.status as (typeof ORDER_STATUS_FLOW)[number]);
  const canCancel = ['pending', 'confirmed'].includes(order.status);
  const canPay = order.payment?.payment_status === 'pending' && !isCancelled;
  const canReview = order.status === 'delivered' && !order.review_id;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
        <Link href="/orders">
          <ArrowLeft className="size-4" /> Захиалгууд
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">Захиалга #{order.order_number}</h1>
            <OrderStatusBadge status={order.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {formatDateTime(order.created_at)} · {order.restaurant_name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-muted-foreground text-xs">Нийт дүн</p>
          <p className="text-primary text-xl font-semibold">{formatMoney(order.total_amount)}</p>
        </div>
      </div>

      {/* Progress */}
      <Card className="mt-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="text-primary size-4" /> Хүргэлтийн явц
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isCancelled ? (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="size-4" /> Захиалга цуцлагдсан
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-7">
              {ORDER_STATUS_FLOW.map((step, index) => {
                const historyEntry = order.status_history?.find((entry) => entry.status === step);
                const done = index <= currentIndex;
                return (
                  <div key={step} className="flex items-start gap-2 sm:flex-col sm:items-center sm:text-center">
                    <div
                      className={cn(
                        'flex size-7 shrink-0 items-center justify-center rounded-full border',
                        done
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'text-muted-foreground border-dashed',
                      )}
                    >
                      {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-3" />}
                    </div>
                    <div>
                      <p className={cn('text-xs font-medium', done ? 'text-foreground' : 'text-muted-foreground')}>
                        {ORDER_STATUS_LABELS[step]}
                      </p>
                      {historyEntry && (
                        <p className="text-muted-foreground text-[10px]">
                          {new Date(historyEntry.created_at).toLocaleTimeString('mn-MN', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {order.delivery?.driver_name && (
            <div className="mt-4 flex items-center justify-between rounded-lg border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Truck className="text-muted-foreground size-4" />
                <div>
                  <p className="font-medium">{order.delivery.driver_name}</p>
                  <p className="text-muted-foreground text-xs">
                    {DELIVERY_STATUS_LABELS[order.delivery.status] ?? order.delivery.status}
                  </p>
                </div>
              </div>
              {order.delivery.driver_phone && (
                <Button asChild variant="outline" size="sm">
                  <a href={`tel:${order.delivery.driver_phone}`}>
                    <Phone className="size-4" /> Залгах
                  </a>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Items */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Захиалсан хоол</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items?.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {item.quantity}× {item.product_name}
                  </p>
                  {item.selected_options?.length > 0 && (
                    <p className="text-muted-foreground text-xs">
                      {item.selected_options.map((option) => option.name).join(' · ')}
                    </p>
                  )}
                  {item.special_instructions && (
                    <p className="text-muted-foreground text-xs italic">“{item.special_instructions}”</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatMoney(item.total_price)}</p>
                  <p className="text-muted-foreground text-xs">{formatMoney(item.unit_price)} / ш</p>
                </div>
              </div>
            ))}
            <Separator />
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хоолны дүн</span>
                <span>{formatMoney(order.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хүргэлт</span>
                <span>{formatMoney(order.delivery_fee)}</span>
              </div>
              {order.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Хямдрал</span>
                  <span>−{formatMoney(order.discount_amount)}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 text-base font-semibold">
                <span>Нийт</span>
                <span>{formatMoney(order.total_amount)}</span>
              </div>
            </div>
            {order.customer_note && (
              <div className="bg-muted/60 rounded-lg p-3 text-sm">
                <p className="text-muted-foreground mb-1 flex items-center gap-1 text-xs">
                  <MessageSquare className="size-3" /> Тэмдэглэл
                </p>
                {order.customer_note}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="text-primary size-4" /> Хүргэлтийн хаяг
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="font-medium">{order.address_title ?? 'Хаяг'}</p>
              <p className="text-muted-foreground">{order.address_text ?? '—'}</p>
              {(order.apartment || order.entrance || order.floor) && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {[
                    order.apartment && `Тоот ${order.apartment}`,
                    order.entrance && `Орц ${order.entrance}`,
                    order.floor && `Давхар ${order.floor}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="text-primary size-4" /> Төлбөр
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Хэлбэр</span>
                <span>{PAYMENT_METHOD_LABELS[order.payment?.payment_method ?? ''] ?? '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Төлөв</span>
                {order.payment ? (
                  <PaymentStatusBadge status={order.payment.payment_status} />
                ) : (
                  <span>—</span>
                )}
              </div>
              {order.payment?.transaction_id && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Гүйлгээ</span>
                  <span className="font-mono text-xs">{order.payment.transaction_id}</span>
                </div>
              )}
              {order.payment?.paid_at && (
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Clock className="size-3" /> {formatDateTime(order.payment.paid_at)}
                </p>
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {canPay && (
              <Button className="w-full" onClick={payNow} disabled={acting}>
                <CreditCard className="size-4" /> Одоо төлөх
              </Button>
            )}
            {canReview && (
              <Button className="w-full" variant="secondary" onClick={() => setReviewOpen(true)}>
                <Star className="size-4" /> Үнэлгээ өгөх
              </Button>
            )}
            {order.review_id && (
              <Badge variant="success" className="w-full justify-center py-2">
                Үнэлгээ өгсөн
              </Badge>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive w-full"
                onClick={cancelOrder}
                disabled={acting}
              >
                <XCircle className="size-4" /> Захиалга цуцлах
              </Button>
            )}
            <Button asChild variant="ghost" className="w-full">
              <Link href={order.restaurant_id ? `/restaurants/${order.restaurant_id}` : '/'}>
                Дахин захиалах
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Үнэлгээ өгөх</DialogTitle>
            <DialogDescription>{order.restaurant_name} рестораны талаар сэтгэгдлээ хуваалцаарай.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  className="cursor-pointer p-1"
                  aria-label={`${value} од`}
                >
                  <Star
                    className={cn(
                      'size-8 transition-colors',
                      value <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40',
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="review-comment">Сэтгэгдэл</Label>
              <Textarea
                id="review-comment"
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Хоолны амт, хүргэлтийн чанарын талаар..."
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>
              Цуцлах
            </Button>
            <Button onClick={submitReview} disabled={acting}>
              Илгээх
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
