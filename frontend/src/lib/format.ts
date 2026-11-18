export const formatMoney = (value: number | string | null | undefined): string => {
  const amount = Number(value ?? 0);
  return `${amount.toLocaleString('mn-MN', { maximumFractionDigits: 0 })}₮`;
};

export const formatDateTime = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  const date = new Date(value);
  return date.toLocaleString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDate = (value: string | Date | null | undefined): string => {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('mn-MN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatTime = (value: string | null | undefined): string => {
  if (!value) return '';
  return value.slice(0, 5);
};

export const DAY_NAMES = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  preparing: 'Бэлтгэж байна',
  ready: 'Бэлэн болсон',
  picked_up: 'Хүргэгч авсан',
  delivering: 'Хүргэж байна',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

export const ORDER_STATUS_FLOW = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'picked_up',
  'delivering',
  'delivered',
] as const;

export const DELIVERY_STATUS_LABELS: Record<string, string> = {
  waiting: 'Хүлээгдэж буй',
  assigned: 'Хуваарилагдсан',
  picked_up: 'Авсан',
  delivering: 'Хүргэж байна',
  delivered: 'Хүргэгдсэн',
  cancelled: 'Цуцлагдсан',
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Хүлээгдэж буй',
  paid: 'Төлөгдсөн',
  failed: 'Амжилтгүй',
  refunded: 'Буцаагдсан',
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Бэлэн мөнгө',
  card: 'Банкны карт',
  qpay: 'QPay',
};

export const ROLE_LABELS: Record<string, string> = {
  customer: 'Хэрэглэгч',
  admin: 'Админ',
  driver: 'Хүргэгч',
};

export function initials(name?: string | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
