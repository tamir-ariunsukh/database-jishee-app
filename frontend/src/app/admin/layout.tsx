'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bike,
  ExternalLink,
  LayoutDashboard,
  LogOut,
  Receipt,
  Star,
  Store,
  Tags,
  Ticket,
  Truck,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { initials, ROLE_LABELS } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { cn } from '@/lib/utils';

const ADMIN_NAV = [
  { href: '/admin', label: 'Хяналтын самбар', icon: LayoutDashboard, exact: true },
  { href: '/admin/orders', label: 'Захиалга', icon: Receipt },
  { href: '/admin/deliveries', label: 'Хүргэлт', icon: Truck },
  { href: '/admin/products', label: 'Бүтээгдэхүүн', icon: UtensilsCrossed },
  { href: '/admin/restaurants', label: 'Ресторан', icon: Store },
  { href: '/admin/categories', label: 'Ангилал', icon: Tags },
  { href: '/admin/drivers', label: 'Хүргэгчид', icon: Bike },
  { href: '/admin/coupons', label: 'Купон', icon: Ticket },
  { href: '/admin/reviews', label: 'Үнэлгээ', icon: Star },
  { href: '/admin/users', label: 'Хэрэглэгчид', icon: Users },
];

const DRIVER_NAV = [
  { href: '/admin/deliveries', label: 'Миний хүргэлт', icon: Truck, exact: true },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role === 'customer') {
      toast.error('Энэ хэсэгт хандах эрх байхгүй');
      router.replace('/');
      return;
    }
    if (user.role === 'driver' && pathname !== '/admin/deliveries') {
      router.replace('/admin/deliveries');
    }
  }, [loading, user, pathname, router]);

  if (loading || !user || user.role === 'customer') {
    return (
      <div className="mx-auto max-w-6xl space-y-3 p-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  const nav = user.role === 'driver' ? DRIVER_NAV : ADMIN_NAV;

  return (
    <div className="bg-muted/30 min-h-svh">
      <div className="mx-auto flex w-full max-w-[1400px]">
        {/* Sidebar */}
        <aside className="bg-sidebar sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r md:flex">
          <div className="flex h-16 items-center gap-2 border-b px-5">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <UtensilsCrossed className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold leading-none">Хүргэлт.mn</p>
              <p className="text-muted-foreground mt-1 text-[11px]">
                {user.role === 'driver' ? 'Хүргэгчийн апп' : 'Админ удирдлага'}
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-3">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent',
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="border-t p-3">
            <Link
              href="/"
              className="text-muted-foreground hover:bg-sidebar-accent flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            >
              <ExternalLink className="size-4" /> Сайт руу буцах
            </Link>
            <Separator className="my-2" />
            <div className="flex items-center gap-2 px-1">
              <Avatar>
                <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                  {initials(user.full_name ?? user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.full_name ?? user.email}</p>
                <p className="text-muted-foreground text-[11px]">{ROLE_LABELS[user.role]}</p>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Гарах"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                <LogOut className="size-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <div className="min-w-0 flex-1">
          <header className="bg-background/85 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-lg md:px-6">
            <div className="flex items-center gap-2 md:hidden">
              <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
                <UtensilsCrossed className="size-4" />
              </span>
              <span className="text-sm font-semibold">Админ</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
              <span className="text-muted-foreground hidden text-sm sm:inline">
                {user.full_name ?? user.email}
              </span>
            </div>
          </header>

          {/* Mobile nav */}
          <div className="no-scrollbar bg-background/90 sticky top-16 z-20 flex gap-1 overflow-x-auto border-b p-2 md:hidden">
            {nav.map((item) => {
              const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'bg-card',
                  )}
                >
                  <item.icon className="size-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>

          <main className="p-4 md:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
