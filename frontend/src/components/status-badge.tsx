import { Badge } from '@/components/ui/badge';
import { ORDER_STATUS_LABELS, DELIVERY_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/lib/format';

const ORDER_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'> = {
  pending: 'warning',
  confirmed: 'info',
  preparing: 'info',
  ready: 'info',
  picked_up: 'info',
  delivering: 'default',
  delivered: 'success',
  cancelled: 'destructive',
};

export function OrderStatusBadge({ status }: { status: string }) {
  return <Badge variant={ORDER_VARIANTS[status] ?? 'secondary'}>{ORDER_STATUS_LABELS[status] ?? status}</Badge>;
}

const DELIVERY_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'> = {
  waiting: 'warning',
  assigned: 'info',
  picked_up: 'info',
  delivering: 'default',
  delivered: 'success',
  cancelled: 'destructive',
};

export function DeliveryStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={DELIVERY_VARIANTS[status] ?? 'secondary'}>
      {DELIVERY_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

const PAYMENT_VARIANTS: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive'> = {
  pending: 'warning',
  paid: 'success',
  failed: 'destructive',
  refunded: 'secondary',
};

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={PAYMENT_VARIANTS[status] ?? 'secondary'}>
      {PAYMENT_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
