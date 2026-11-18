'use client';

import Link from 'next/link';
import { Clock, Heart, Star, Truck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/format';
import type { Restaurant } from '@/lib/types';

interface Props {
  restaurant: Restaurant;
  favorite?: boolean;
  onToggleFavorite?: (restaurant: Restaurant) => void;
}

export function RestaurantCard({ restaurant, favorite, onToggleFavorite }: Props) {
  return (
    <div className="group bg-card relative overflow-hidden rounded-2xl border shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/restaurants/${restaurant.id}`} className="block">
        <div className="bg-muted relative aspect-[16/9] overflow-hidden">
          {restaurant.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={restaurant.cover_url}
              alt={restaurant.name}
              loading="lazy"
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-4xl">🍽️</div>
          )}
          {!restaurant.is_active && (
            <div className="bg-background/80 absolute inset-0 flex items-center justify-center text-sm font-medium backdrop-blur-[1px]">
              Түр хаалттай
            </div>
          )}
          <Badge className="absolute top-2 left-2 gap-1 bg-white/90 text-foreground shadow-sm hover:bg-white">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            {Number(restaurant.avg_rating).toFixed(1)}
            <span className="text-muted-foreground font-normal">({restaurant.review_count})</span>
          </Badge>
        </div>
      </Link>

      {onToggleFavorite && (
        <Button
          type="button"
          variant="secondary"
          size="icon-sm"
          aria-label="Дуртайд нэмэх"
          onClick={() => onToggleFavorite(restaurant)}
          className="absolute top-2 right-2 rounded-full bg-white/90 shadow-sm hover:bg-white"
        >
          <Heart
            className={cn('size-4', favorite ? 'fill-rose-500 text-rose-500' : 'text-foreground/70')}
          />
        </Button>
      )}

      <div className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/restaurants/${restaurant.id}`} className="font-semibold hover:underline">
            {restaurant.name}
          </Link>
          {restaurant.min_order_amount > 0 && (
            <span className="text-muted-foreground shrink-0 text-xs">
              мин {formatMoney(restaurant.min_order_amount)}
            </span>
          )}
        </div>
        <p className="text-muted-foreground line-clamp-2 text-sm">
          {restaurant.description ?? 'Амттай хоол, хурдан хүргэлт.'}
        </p>
        <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Truck className="size-3.5" /> {formatMoney(restaurant.delivery_fee)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" /> {restaurant.estimated_delivery_minutes ?? 30} мин
          </span>
        </div>
      </div>
    </div>
  );
}
