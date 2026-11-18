'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Clock,
  MapPin,
  Minus,
  Phone,
  Plus,
  ShoppingBag,
  Truck,
  Utensils,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Stars } from '@/components/stars';
import { api, errorMessage } from '@/lib/api';
import { DAY_NAMES, formatMoney, formatTime } from '@/lib/format';
import { useAuth, useCart } from '@/lib/providers';
import type { OptionGroup, Product, Restaurant } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function RestaurantPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { cart, addItem, count } = useCart();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [optionGroups, setOptionGroups] = useState<OptionGroup[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!params.id) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      api<{ data: Restaurant }>(`/restaurants/${params.id}`),
      api<{ data: Product[] }>(`/products?restaurant_id=${params.id}&limit=200`),
    ])
      .then(([detail, menu]) => {
        if (cancelled) return;
        setRestaurant(detail.data);
        setProducts(menu.data.filter((product) => product.is_available));
      })
      .catch((error) => {
        if (!cancelled) toast.error(errorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const product of products) {
      if (product.category_id && product.category_name) {
        map.set(product.category_id, { id: product.category_id, name: product.category_name });
      }
    }
    return [...map.values()];
  }, [products]);

  const visibleProducts = useMemo(
    () =>
      activeCategory === 'all'
        ? products
        : products.filter((product) => product.category_id === activeCategory),
    [products, activeCategory],
  );

  const today = new Date().getDay();
  const todayHours = restaurant?.hours?.find((hour) => hour.day_of_week === today);
  const isOpenNow = useMemo(() => {
    if (!todayHours) return true;
    if (todayHours.is_closed) return false;
    if (!todayHours.open_time || !todayHours.close_time) return true;
    const now = new Date();
    const current = now.getHours() * 60 + now.getMinutes();
    const [openH, openM] = todayHours.open_time.split(':').map(Number);
    const [closeH, closeM] = todayHours.close_time.split(':').map(Number);
    return current >= openH * 60 + openM && current <= closeH * 60 + closeM;
  }, [todayHours]);

  const openProductDialog = useCallback(async (product: Product) => {
    setSelectedProduct(product);
    setPicked({});
    setQuantity(1);
    setNote('');
    setOptionGroups([]);
    setLoadingOptions(true);
    try {
      const res = await api<{ data: OptionGroup[] }>(`/products/${product.id}/option-groups`);
      setOptionGroups(res.data);
      const initial: Record<string, string[]> = {};
      for (const group of res.data) {
        initial[group.id] = [];
      }
      setPicked(initial);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoadingOptions(false);
    }
  }, []);

  const toggleOption = (group: OptionGroup, optionId: string) => {
    setPicked((prev) => {
      const current = prev[group.id] ?? [];
      if (group.max_select === 1) {
        return { ...prev, [group.id]: [optionId] };
      }
      if (current.includes(optionId)) {
        return { ...prev, [group.id]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= group.max_select) {
        toast.message(`${group.name}: хамгийн ихдээ ${group.max_select} сонгоно`);
        return prev;
      }
      return { ...prev, [group.id]: [...current, optionId] };
    });
  };

  const selectedOptionIds = useMemo(() => Object.values(picked).flat(), [picked]);

  const unitPrice = useMemo(() => {
    if (!selectedProduct) return 0;
    const base = Number(selectedProduct.discount_price ?? selectedProduct.price);
    const extra = optionGroups
      .flatMap((group) => group.options)
      .filter((option) => selectedOptionIds.includes(option.id))
      .reduce((sum, option) => sum + Number(option.additional_price), 0);
    return base + extra;
  }, [selectedProduct, optionGroups, selectedOptionIds]);

  const missingRequired = optionGroups.filter(
    (group) => group.required && (picked[group.id]?.length ?? 0) < Math.max(1, group.min_select),
  );

  const handleAddToCart = async () => {
    if (!selectedProduct) return;
    if (!user) {
      toast.error('Захиалга хийхийн тулд нэвтэрнэ үү');
      router.push('/login');
      return;
    }
    if (missingRequired.length) {
      toast.error(`${missingRequired[0].name} сонгоно уу`);
      return;
    }
    setSubmitting(true);
    try {
      await addItem({
        productId: selectedProduct.id,
        quantity,
        optionIds: selectedOptionIds,
        specialInstructions: note.trim() || null,
      });
      toast.success(`${selectedProduct.name} сагсанд нэмэгдлээ`);
      setSelectedProduct(null);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-6">
        <Skeleton className="h-56 w-full rounded-2xl" />
        <div className="mt-6 space-y-3">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="mt-8 grid gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <p className="text-lg font-medium">Ресторан олдсонгүй</p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/">Нүүр хуудас</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-24">
      <div className="pt-4">
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href="/">
            <ArrowLeft className="size-4" /> Буцах
          </Link>
        </Button>
      </div>

      {/* Cover */}
      <div className="bg-muted relative mt-2 aspect-[21/9] overflow-hidden rounded-2xl border">
        {restaurant.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={restaurant.cover_url}
            alt={restaurant.name}
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-6xl">🍽️</div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute right-4 bottom-4 left-4 text-white">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={isOpenNow ? 'success' : 'destructive'}
              className="border-0 backdrop-blur"
            >
              {isOpenNow ? 'Нээлттэй' : 'Хаалттай'}
            </Badge>
            {restaurant.min_order_amount > 0 && (
              <Badge variant="secondary" className="border-0">
                Мин. захиалга {formatMoney(restaurant.min_order_amount)}
              </Badge>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">{restaurant.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-white/85">{restaurant.description}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="bg-amber-500/15 text-amber-600 flex size-10 items-center justify-center rounded-lg">
              <Stars value={Number(restaurant.avg_rating)} />
            </div>
            <div>
              <p className="text-sm font-medium">
                {Number(restaurant.avg_rating).toFixed(1)} · {restaurant.review_count} үнэлгээ
              </p>
              <p className="text-muted-foreground text-xs">Хэрэглэгчдийн үнэлгээ</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-lg">
              <Truck className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{formatMoney(restaurant.delivery_fee)}</p>
              <p className="text-muted-foreground text-xs">Хүргэлтийн төлбөр</p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                {restaurant.estimated_delivery_minutes ?? 30} минут
              </p>
              <p className="text-muted-foreground text-xs">
                {todayHours
                  ? todayHours.is_closed
                    ? `Өнөөдөр хаалттай (${DAY_NAMES[today]})`
                    : `${formatTime(todayHours.open_time)} – ${formatTime(todayHours.close_time)}`
                  : 'Хуваарь байхгүй'}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="py-4">
          <CardContent className="flex items-center gap-3 px-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600">
              <Phone className="size-5" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{restaurant.phone ?? '—'}</p>
              <p className="text-muted-foreground truncate text-xs">
                {restaurant.address ?? 'Хаяг байхгүй'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Menu */}
      <div className="mt-8">
        <div className="flex items-center gap-2">
          <Utensils className="text-primary size-5" />
          <h2 className="text-xl font-semibold">Цэс</h2>
          <Badge variant="secondary">{products.length} хоол</Badge>
        </div>

        <div className="no-scrollbar mt-4 flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={cn(
              'shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
              activeCategory === 'all'
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-card hover:bg-accent',
            )}
          >
            Бүгд
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                'shrink-0 cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                activeCategory === category.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {visibleProducts.map((product) => {
            const price = Number(product.discount_price ?? product.price);
            const hasDiscount = product.discount_price != null && product.discount_price < product.price;
            return (
              <Card key={product.id} className="overflow-hidden py-0">
                <div className="flex gap-4 p-3">
                  <div className="bg-muted size-24 shrink-0 overflow-hidden rounded-xl">
                    {product.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl">🍲</div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium">{product.name}</p>
                        {product.preparation_minutes && (
                          <span className="text-muted-foreground shrink-0 text-xs">
                            {product.preparation_minutes} мин
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground mt-0.5 line-clamp-2 text-sm">
                        {product.description}
                      </p>
                    </div>
                    <div className="mt-2 flex items-end justify-between gap-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-primary font-semibold">{formatMoney(price)}</span>
                        {hasDiscount && (
                          <span className="text-muted-foreground text-xs line-through">
                            {formatMoney(product.price)}
                          </span>
                        )}
                      </div>
                      <Button size="sm" onClick={() => openProductDialog(product)}>
                        <Plus className="size-4" /> Нэмэх
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Reviews */}
      {restaurant.reviews && restaurant.reviews.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-semibold">Сүүлийн үнэлгээнүүд</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {restaurant.reviews.slice(0, 6).map((review) => (
              <Card key={review.id} className="py-4">
                <CardContent className="space-y-2 px-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{review.full_name ?? 'Хэрэглэгч'}</p>
                    <Stars value={review.rating} />
                  </div>
                  {review.comment && (
                    <p className="text-muted-foreground text-sm">{review.comment}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sticky cart bar */}
      {count > 0 && cart?.restaurant_id === restaurant.id && (
        <div className="fixed inset-x-0 bottom-16 z-30 px-4 md:bottom-6">
          <div className="mx-auto max-w-3xl">
            <Button
              asChild
              size="lg"
              className="h-14 w-full justify-between px-5 text-base shadow-xl"
            >
              <Link href="/cart">
                <span className="flex items-center gap-2">
                  <ShoppingBag className="size-5" />
                  {count} хоол · {formatMoney(cart.subtotal)}
                </span>
                <span>Сагс харах →</span>
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Product dialog */}
      <Dialog open={Boolean(selectedProduct)} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-lg">
          {selectedProduct && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedProduct.name}</DialogTitle>
                <DialogDescription>
                  {selectedProduct.description ?? 'Нэмэлт сонголтоо хийнэ үү.'}
                </DialogDescription>
              </DialogHeader>

              {loadingOptions ? (
                <div className="space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : (
                <div className="space-y-5">
                  {optionGroups.map((group) => (
                    <div key={group.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">
                          {group.name}
                          {group.required && <span className="text-destructive">*</span>}
                        </Label>
                        <span className="text-muted-foreground text-xs">
                          {group.max_select === 1
                            ? '1 сонгох'
                            : `${group.min_select}–${group.max_select} сонгох`}
                        </span>
                      </div>
                      {group.max_select === 1 ? (
                        <RadioGroup
                          value={picked[group.id]?.[0] ?? ''}
                          onValueChange={(value) => toggleOption(group, value)}
                        >
                          {group.options.map((option) => (
                            <label
                              key={option.id}
                              className="hover:bg-accent/60 flex cursor-pointer items-center justify-between rounded-lg border p-3"
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <RadioGroupItem value={option.id} id={option.id} />
                                {option.name}
                              </span>
                              {Number(option.additional_price) > 0 && (
                                <span className="text-muted-foreground text-sm">
                                  +{formatMoney(option.additional_price)}
                                </span>
                              )}
                            </label>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="space-y-2">
                          {group.options.map((option) => (
                            <label
                              key={option.id}
                              className="hover:bg-accent/60 flex cursor-pointer items-center justify-between rounded-lg border p-3"
                            >
                              <span className="flex items-center gap-2 text-sm">
                                <Checkbox
                                  checked={picked[group.id]?.includes(option.id) ?? false}
                                  onCheckedChange={() => toggleOption(group, option.id)}
                                />
                                {option.name}
                              </span>
                              {Number(option.additional_price) > 0 && (
                                <span className="text-muted-foreground text-sm">
                                  +{formatMoney(option.additional_price)}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="space-y-2">
                    <Label htmlFor="note">Тусгай заавар</Label>
                    <Textarea
                      id="note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder="Жишээ: сонгиногүй, соусыг тусад нь..."
                      maxLength={300}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="size-4" />
                      </Button>
                      <span className="w-8 text-center font-medium">{quantity}</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon-sm"
                        onClick={() => setQuantity((value) => Math.min(50, value + 1))}
                      >
                        <Plus className="size-4" />
                      </Button>
                    </div>
                    <div className="text-right">
                      <p className="text-muted-foreground text-xs">Нийт</p>
                      <p className="text-lg font-semibold">{formatMoney(unitPrice * quantity)}</p>
                    </div>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedProduct(null)}>
                  Цуцлах
                </Button>
                <Button onClick={handleAddToCart} disabled={submitting || loadingOptions}>
                  <ShoppingBag className="size-4" />
                  {submitting ? 'Нэмж байна...' : 'Сагсанд нэмэх'}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
