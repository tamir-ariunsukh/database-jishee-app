'use client';

import Link from 'next/link';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api';
import { formatMoney } from '@/lib/format';
import { useAuth, useCart } from '@/lib/providers';

export default function CartPage() {
  const { user, loading: authLoading } = useAuth();
  const { cart, loading, setQuantity, removeItem, clear } = useCart();

  const handleQuantity = async (itemId: string, quantity: number) => {
    try {
      await setQuantity(itemId, quantity);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (authLoading) {
    return (
      <div className="mx-auto max-w-4xl space-y-3 px-4 py-10">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="bg-muted mx-auto flex size-16 items-center justify-center rounded-full text-2xl">
          🔐
        </div>
        <h1 className="mt-4 text-xl font-semibold">Сагсаа харахын тулд нэвтэрнэ үү</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Захиалга хийх, хаягаа хадгалах боломжтой болно.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Button asChild>
            <Link href="/login">Нэвтрэх</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/register">Бүртгүүлэх</Link>
          </Button>
        </div>
      </div>
    );
  }

  const empty = !cart || cart.items.length === 0;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Миний сагс</h1>
          <p className="text-muted-foreground text-sm">
            {empty ? 'Сагс хоосон байна' : `${cart?.item_count} хоол · ${cart?.restaurant_name}`}
          </p>
        </div>
        {!empty && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              try {
                await clear();
                toast.success('Сагс хоослогдлоо');
              } catch (error) {
                toast.error(errorMessage(error));
              }
            }}
          >
            <Trash2 className="size-4" /> Хоослох
          </Button>
        )}
      </div>

      {loading && !cart ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-28 w-full rounded-xl" />
        </div>
      ) : empty ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-full text-2xl">
              🛒
            </div>
            <div>
              <p className="font-medium">Сагс хоосон байна</p>
              <p className="text-muted-foreground text-sm">
                Дуртай ресторанаасаа хоол сонгож эхлээрэй.
              </p>
            </div>
            <Button asChild>
              <Link href="/">
                <ShoppingBag className="size-4" /> Ресторан үзэх
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div className="space-y-3">
            {cart!.items.map((item) => (
              <Card key={item.id} className="py-0">
                <div className="flex gap-3 p-3">
                  <div className="bg-muted size-20 shrink-0 overflow-hidden rounded-lg">
                    {item.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.image_url}
                        alt={item.product_name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xl">🍲</div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{item.product_name}</p>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={async () => {
                            try {
                              await removeItem(item.id);
                            } catch (error) {
                              toast.error(errorMessage(error));
                            }
                          }}
                          aria-label="Устгах"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                      {item.selected_options.length > 0 && (
                        <p className="text-muted-foreground text-xs">
                          {item.selected_options.map((option) => option.name).join(' · ')}
                        </p>
                      )}
                      {item.special_instructions && (
                        <p className="text-muted-foreground mt-1 text-xs italic">
                          “{item.special_instructions}”
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleQuantity(item.id, item.quantity - 1)}
                          disabled={item.quantity <= 1}
                          aria-label="Хасах"
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon-sm"
                          onClick={() => handleQuantity(item.id, item.quantity + 1)}
                          aria-label="Нэмэх"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                      <span className="font-semibold">{formatMoney(item.line_total)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}

            <Button asChild variant="outline" className="w-full">
              <Link href={cart!.restaurant_id ? `/restaurants/${cart!.restaurant_id}` : '/'}>
                <Plus className="size-4" /> Өөр хоол нэмэх
              </Link>
            </Button>
          </div>

          <div>
            <Card className="sticky top-20">
              <CardHeader>
                <CardTitle>Захиалгын дүн</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Хоолны дүн</span>
                  <span>{formatMoney(cart!.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Хүргэлт</span>
                  <span>{formatMoney(cart!.delivery_fee)}</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between text-base font-semibold">
                  <span>Нийт</span>
                  <span className="text-primary">{formatMoney(cart!.total)}</span>
                </div>
                {cart!.min_order_amount > 0 && cart!.subtotal < cart!.min_order_amount && (
                  <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                    Захиалгын доод дүн {formatMoney(cart!.min_order_amount)}. Дахин{' '}
                    {formatMoney(cart!.min_order_amount - cart!.subtotal)} нэмэх шаардлагатай.
                  </p>
                )}
                <Button
                  asChild
                  size="lg"
                  className="w-full"
                  disabled={cart!.subtotal < cart!.min_order_amount}
                >
                  <Link
                    href="/checkout"
                    aria-disabled={cart!.subtotal < cart!.min_order_amount}
                    className={
                      cart!.subtotal < cart!.min_order_amount ? 'pointer-events-none opacity-50' : ''
                    }
                  >
                    Захиалга үргэлжлүүлэх <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
