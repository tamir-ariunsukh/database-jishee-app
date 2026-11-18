'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BadgeCheck,
  Banknote,
  CreditCard,
  MapPin,
  Plus,
  QrCode,
  Tag,
  X,
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { api, errorMessage } from '@/lib/api';
import { formatMoney, PAYMENT_METHOD_LABELS } from '@/lib/format';
import { useAuth, useCart } from '@/lib/providers';
import type { Address, Order } from '@/lib/types';
import { cn } from '@/lib/utils';

const PAYMENT_OPTIONS = [
  { value: 'card', label: 'Банкны карт', icon: CreditCard, hint: 'Онлайн төлбөр (туршилт)' },
  { value: 'qpay', label: 'QPay', icon: QrCode, hint: 'QR кодоор төлөх' },
  { value: 'cash', label: 'Бэлэн мөнгө', icon: Banknote, hint: 'Хүргэлтийн үед төлөх' },
];

export default function CheckoutPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { cart, loading: cartLoading, refresh } = useCart();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string>('');
  const [loadingAddresses, setLoadingAddresses] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState('card');
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [note, setNote] = useState('');
  const [placing, setPlacing] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newAddress, setNewAddress] = useState({
    title: 'Гэр',
    address: '',
    apartment: '',
    entrance: '',
    floor: '',
    is_default: true,
  });

  const loadAddresses = async () => {
    if (!token) return;
    setLoadingAddresses(true);
    try {
      const res = await api<{ data: Address[] }>('/addresses', { token });
      setAddresses(res.data);
      setAddressId((current) => current || res.data.find((a) => a.is_default)?.id || res.data[0]?.id || '');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingAddresses(false);
    }
  };

  useEffect(() => {
    void loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  useEffect(() => {
    if (!cartLoading && cart && cart.items.length === 0 && !placing) {
      router.replace('/cart');
    }
  }, [cartLoading, cart, router, placing]);

  const subtotal = cart?.subtotal ?? 0;
  const deliveryFee = cart?.delivery_fee ?? 0;
  const discount = coupon?.discount ?? 0;
  const total = useMemo(() => Math.max(0, subtotal - discount + deliveryFee), [subtotal, discount, deliveryFee]);

  const applyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) return;
    setCouponLoading(true);
    try {
      const res = await api<{ data: { code: string; discount: number } }>('/coupons/validate', {
        method: 'POST',
        token,
        body: { code, subtotal },
      });
      setCoupon({ code: res.data.code, discount: res.data.discount });
      toast.success(`Купон хэрэглэгдлээ: -${formatMoney(res.data.discount)}`);
    } catch (error) {
      setCoupon(null);
      toast.error(errorMessage(error));
    } finally {
      setCouponLoading(false);
    }
  };

  const createAddress = async () => {
    if (newAddress.address.trim().length < 3) {
      toast.error('Хаягаа дэлгэрэнгүй оруулна уу');
      return;
    }
    try {
      const res = await api<{ data: Address }>('/addresses', {
        method: 'POST',
        token,
        body: {
          title: newAddress.title || 'Гэр',
          address: newAddress.address,
          apartment: newAddress.apartment || null,
          entrance: newAddress.entrance || null,
          floor: newAddress.floor || null,
          is_default: newAddress.is_default,
        },
      });
      setAddresses((prev) => [res.data, ...prev]);
      setAddressId(res.data.id);
      setDialogOpen(false);
      setNewAddress({ title: 'Гэр', address: '', apartment: '', entrance: '', floor: '', is_default: true });
      toast.success('Хаяг нэмэгдлээ');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const placeOrder = async () => {
    if (!addressId) {
      toast.error('Хүргэлтийн хаяг сонгоно уу');
      return;
    }
    setPlacing(true);
    try {
      const res = await api<{ data: Order }>('/orders', {
        method: 'POST',
        token,
        body: {
          address_id: addressId,
          payment_method: paymentMethod,
          coupon_code: coupon?.code ?? null,
          customer_note: note.trim() || null,
        },
      });
      await refresh();
      toast.success(`Захиалга #${res.data.order_number} амжилттай үүслээ`);
      router.push(`/orders/${res.data.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setPlacing(false);
    }
  };

  if (authLoading || cartLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Захиалга баталгаажуулах</h1>
      <p className="text-muted-foreground text-sm">{cart?.restaurant_name}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {/* Addresses */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="text-primary size-4" /> Хүргэлтийн хаяг
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" /> Хаяг нэмэх
              </Button>
            </CardHeader>
            <CardContent>
              {loadingAddresses ? (
                <Skeleton className="h-20 w-full" />
              ) : addresses.length === 0 ? (
                <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
                  Одоогоор хаяг байхгүй байна. “Хаяг нэмэх” товчийг дарна уу.
                </div>
              ) : (
                <RadioGroup value={addressId} onValueChange={setAddressId} className="gap-2">
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={cn(
                        'flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors',
                        addressId === address.id ? 'border-primary bg-primary/5' : 'hover:bg-accent/60',
                      )}
                    >
                      <RadioGroupItem value={address.id} className="mt-1" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{address.title ?? 'Хаяг'}</span>
                          {address.is_default && <Badge variant="secondary">Үндсэн</Badge>}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-sm">{address.address}</p>
                        {(address.apartment || address.entrance || address.floor) && (
                          <p className="text-muted-foreground text-xs">
                            {[
                              address.apartment && `Тоот ${address.apartment}`,
                              address.entrance && `Орц ${address.entrance}`,
                              address.floor && `Давхар ${address.floor}`,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </CardContent>
          </Card>

          {/* Payment */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CreditCard className="text-primary size-4" /> Төлбөрийн хэлбэр
              </CardTitle>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={setPaymentMethod}
                className="grid gap-2 sm:grid-cols-3"
              >
                {PAYMENT_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-colors',
                      paymentMethod === option.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:bg-accent/60',
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <RadioGroupItem value={option.value} />
                      <option.icon className="size-4" />
                      <span className="text-sm font-medium">{option.label}</span>
                    </div>
                    <span className="text-muted-foreground pl-6 text-xs">{option.hint}</span>
                  </label>
                ))}
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Coupon + note */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="text-primary size-4" /> Купон ба тэмдэглэл
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {coupon ? (
                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <BadgeCheck className="size-4 text-emerald-600" />
                    <span className="font-medium">{coupon.code}</span>
                    <span className="text-muted-foreground">
                      −{formatMoney(coupon.discount)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => {
                      setCoupon(null);
                      setCouponCode('');
                    }}
                    aria-label="Купон хасах"
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={couponCode}
                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                    placeholder="Купон код (жишээ: WELCOME10)"
                  />
                  <Button variant="outline" onClick={applyCoupon} disabled={couponLoading || !couponCode}>
                    {couponLoading ? 'Шалгаж...' : 'Хэрэглэх'}
                  </Button>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="order-note">Захиалгын тэмдэглэл</Label>
                <Textarea
                  id="order-note"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Хаалганы хонхо, хүргэлтийн заавар..."
                  maxLength={300}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary */}
        <div>
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle className="text-base">Таны захиалга</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {cart?.items.map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {item.quantity}× {item.product_name}
                      </p>
                      {item.selected_options.length > 0 && (
                        <p className="text-muted-foreground truncate text-xs">
                          {item.selected_options.map((o) => o.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0">{formatMoney(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хоолны дүн</span>
                <span>{formatMoney(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Хүргэлт</span>
                <span>{formatMoney(deliveryFee)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Хямдрал</span>
                  <span>−{formatMoney(discount)}</span>
                </div>
              )}
              <Separator />
              <div className="flex items-center justify-between text-base font-semibold">
                <span>Нийт төлөх</span>
                <span className="text-primary">{formatMoney(total)}</span>
              </div>
              <p className="text-muted-foreground text-xs">
                Төлбөрийн хэлбэр: {PAYMENT_METHOD_LABELS[paymentMethod]}
              </p>
              <Button
                size="lg"
                className="w-full"
                onClick={placeOrder}
                disabled={placing || !addressId || !cart?.items.length}
              >
                {placing ? 'Илгээж байна...' : 'Захиалга хийх'}
              </Button>
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/cart">Сагс руу буцах</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Шинэ хаяг нэмэх</DialogTitle>
            <DialogDescription>Хүргэлт хийх хаягаа дэлгэрэнгүй оруулна уу.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="address-title">Хаягийн нэр</Label>
              <Input
                id="address-title"
                value={newAddress.title}
                onChange={(event) => setNewAddress({ ...newAddress, title: event.target.value })}
                placeholder="Гэр, Ажил..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="address-text">Хаяг</Label>
              <Textarea
                id="address-text"
                value={newAddress.address}
                onChange={(event) => setNewAddress({ ...newAddress, address: event.target.value })}
                placeholder="Дүүрэг, хороо, гудамж, байр..."
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="address-apartment">Тоот</Label>
                <Input
                  id="address-apartment"
                  value={newAddress.apartment}
                  onChange={(event) =>
                    setNewAddress({ ...newAddress, apartment: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-entrance">Орц</Label>
                <Input
                  id="address-entrance"
                  value={newAddress.entrance}
                  onChange={(event) =>
                    setNewAddress({ ...newAddress, entrance: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="address-floor">Давхар</Label>
                <Input
                  id="address-floor"
                  value={newAddress.floor}
                  onChange={(event) => setNewAddress({ ...newAddress, floor: event.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Үндсэн хаяг болгох</Label>
                <p className="text-muted-foreground text-xs">Дараагийн захиалгад автоматаар сонгогдоно</p>
              </div>
              <Switch
                checked={newAddress.is_default}
                onCheckedChange={(checked) => setNewAddress({ ...newAddress, is_default: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Цуцлах
            </Button>
            <Button onClick={createAddress}>Хадгалах</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
