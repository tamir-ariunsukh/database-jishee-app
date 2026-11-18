'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { RestaurantCard } from '@/components/restaurant-card';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/providers';
import type { Restaurant } from '@/lib/types';

export default function FavoritesPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: Restaurant[] }>('/favorites', { token });
      setRestaurants(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const remove = async (restaurant: Restaurant) => {
    try {
      await api(`/favorites/${restaurant.id}`, { method: 'DELETE', token });
      setRestaurants((prev) => prev.filter((item) => item.id !== restaurant.id));
      toast.success('Дуртай жагсаалтаас хаслаа');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="flex items-center gap-2">
        <Heart className="fill-rose-500 text-rose-500 size-6" />
        <h1 className="text-2xl font-semibold tracking-tight">Дуртай ресторанууд</h1>
      </div>
      <p className="text-muted-foreground mt-1 text-sm">Хадгалсан ресторануудаа эндээс хурдан олоорой.</p>

      {loading ? (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-72 w-full rounded-2xl" />
          ))}
        </div>
      ) : restaurants.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="bg-muted flex size-16 items-center justify-center rounded-full text-2xl">💛</div>
            <div>
              <p className="font-medium">Дуртай ресторан байхгүй</p>
              <p className="text-muted-foreground text-sm">
                Рестораны карт дээрх зүрх товчийг дарж хадгалаарай.
              </p>
            </div>
            <Button asChild>
              <Link href="/">Ресторан үзэх</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {restaurants.map((restaurant) => (
            <RestaurantCard
              key={restaurant.id}
              restaurant={restaurant}
              favorite
              onToggleFavorite={remove}
            />
          ))}
        </div>
      )}
    </div>
  );
}
