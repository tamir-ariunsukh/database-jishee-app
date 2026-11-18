import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import RestaurantDetail from './restaurant-detail';

function DetailFallback() {
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

export default function RestaurantPage() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <RestaurantDetail />
    </Suspense>
  );
}
