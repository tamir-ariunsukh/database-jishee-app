'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Sparkles, Star, Truck, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { RestaurantCard } from '@/components/restaurant-card';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Category, Paginated, Restaurant } from '@/lib/types';
import { cn } from '@/lib/utils';

const SORTS = [
  { value: 'newest', label: 'Шинээр нэмэгдсэн' },
  { value: 'rating', label: 'Үнэлгээгээр' },
  { value: 'delivery_fee', label: 'Хүргэлтийн төлбөр' },
  { value: 'delivery_time', label: 'Хүргэлтийн хугацаа' },
  { value: 'name', label: 'Нэрээр' },
];

export default function HomePage() {
  const { user, token } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [sort, setSort] = useState('newest');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api<{ data: Category[] }>('/categories')
      .then((res) => setCategories(res.data.filter((c) => c.is_active)))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const loadFavorites = useCallback(async () => {
    if (!token) {
      setFavoriteIds(new Set());
      return;
    }
    try {
      const res = await api<{ data: Restaurant[] }>('/favorites', { token });
      setFavoriteIds(new Set(res.data.map((r) => r.id)));
    } catch {
      // ignore
    }
  }, [token]);

  useEffect(() => {
    void loadFavorites();
  }, [loadFavorites]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams({ limit: '24', sort });
    if (debounced) params.set('q', debounced);
    if (categoryId !== 'all') params.set('category_id', categoryId);

    api<Paginated<Restaurant>>(`/restaurants?${params.toString()}`)
      .then((res) => {
        if (cancelled) return;
        setRestaurants(res.data);
        setTotal(res.total);
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
  }, [debounced, categoryId, sort]);

  const toggleFavorite = async (restaurant: Restaurant) => {
    if (!token) {
      toast.error('Дуртайд нэмэхийн тулд нэвтэрнэ үү');
      return;
    }
    const isFavorite = favoriteIds.has(restaurant.id);
    try {
      if (isFavorite) {
        await api(`/favorites/${restaurant.id}`, { method: 'DELETE', token });
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(restaurant.id);
          return next;
        });
        toast.success('Дуртай жагсаалтаас хаслаа');
      } else {
        await api('/favorites', { method: 'POST', token, body: { restaurant_id: restaurant.id } });
        setFavoriteIds((prev) => new Set(prev).add(restaurant.id));
        toast.success('Дуртай жагсаалтад нэмлээ');
      }
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const stats = useMemo(
    () => [
      { icon: Sparkles, label: 'Ресторан', value: total },
      { icon: Star, label: 'Ангилал', value: categories.length },
      { icon: Truck, label: 'Хүргэлт', value: '25–40 мин' },
    ],
    [total, categories.length],
  );

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div className="from-primary/15 via-background to-accent/50 absolute inset-0 bg-gradient-to-br" />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-14 md:py-20">
          <Badge variant="secondary" className="mb-4 gap-1 px-3 py-1">
            <Sparkles className="size-3.5 text-primary" /> Улаанбаатар хотод хүргэлт
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-balance md:text-6xl">
            Дуртай хоолоо <span className="text-primary">хурдан</span> хүргүүлээрэй
          </h1>
          <p className="text-muted-foreground mt-4 max-w-xl text-base md:text-lg">
            Бургер, пицца, суши, кофе — шилдэг ресторануудаас сонгон захиалж, гэртээ хүлээн аваарай.
          </p>

          <form
            className="mt-8 flex max-w-xl gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setDebounced(query.trim());
            }}
          >
            <div className="relative flex-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ресторан, хоол хайх..."
                className="bg-background h-12 pl-9 text-base shadow-sm"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  aria-label="Хайлт цэвэрлэх"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <Button type="submit" size="lg" className="h-12 px-6">
              Хайх
            </Button>
          </form>

          <div className="text-muted-foreground mt-8 flex flex-wrap gap-6 text-sm">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <stat.icon className="text-primary size-4" />
                <span className="text-foreground font-semibold">{stat.value}</span>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-10">
        {/* Categories */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-2">
          <button
            type="button"
            onClick={() => setCategoryId('all')}
            className={cn(
              'shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors',
              categoryId === 'all'
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
              onClick={() => setCategoryId(category.id)}
              className={cn(
                'shrink-0 cursor-pointer rounded-full border px-4 py-2 text-sm font-medium transition-colors',
                categoryId === category.id
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-card hover:bg-accent',
              )}
            >
              {category.name}
            </button>
          ))}
        </div>

        <div className="mt-8 mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Ресторанууд</h2>
            <p className="text-muted-foreground text-sm">
              {loading ? 'Ачаалж байна...' : `${total} ресторан олдлоо`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground hidden text-sm sm:inline">Эрэмбэлэх:</span>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-48 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORTS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="space-y-3 rounded-2xl border p-3">
                <Skeleton className="aspect-[16/9] w-full rounded-xl" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : restaurants.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="bg-muted flex size-14 items-center justify-center rounded-full text-2xl">
                🔍
              </div>
              <div>
                <p className="font-medium">Илэрц олдсонгүй</p>
                <p className="text-muted-foreground text-sm">
                  Өөр түлхүүр үг эсвэл ангилал сонгож үзнэ үү.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setQuery('');
                  setCategoryId('all');
                }}
              >
                Шүүлтүүр цэвэрлэх
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {restaurants.map((restaurant) => (
              <RestaurantCard
                key={restaurant.id}
                restaurant={restaurant}
                favorite={favoriteIds.has(restaurant.id)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        )}

        {!user && (
          <Card className="from-primary/10 to-accent/40 mt-10 bg-gradient-to-r">
            <CardContent className="flex flex-col items-start gap-4 py-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold">Захиалга хийхэд бэлэн үү?</p>
                <p className="text-muted-foreground text-sm">
                  Бүртгүүлээд хүргэлтийн хаягаа хадгалаарай — дараагийн захиалга 1 товшилтоор.
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline">
                  <Link href="/login">Нэвтрэх</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Бүртгүүлэх</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
