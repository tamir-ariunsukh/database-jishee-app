import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import OrderDetail from './order-detail';

function DetailFallback() {
  return (
    <div className="mx-auto max-w-4xl space-y-3 px-4 py-10">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-40 w-full rounded-xl" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<DetailFallback />}>
      <OrderDetail />
    </Suspense>
  );
}
