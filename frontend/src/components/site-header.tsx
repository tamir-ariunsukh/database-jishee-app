'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Heart,
  LayoutDashboard,
  LogOut,
  Receipt,
  ShoppingBag,
  User as UserIcon,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth, useCart } from '@/lib/providers';
import { initials } from '@/lib/format';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/', label: 'Ресторанууд', icon: UtensilsCrossed },
  { href: '/orders', label: 'Захиалга', icon: Receipt },
  { href: '/favorites', label: 'Дуртай', icon: Heart },
];

export function SiteHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAdmin } = useAuth();
  const { count } = useCart();

  const handleLogout = () => {
    logout();
    toast.success('Системээс гарлаа');
    router.push('/');
  };

  return (
    <header className="bg-background/85 supports-[backdrop-filter]:bg-background/65 sticky top-0 z-40 border-b backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-xl shadow-sm">
            <UtensilsCrossed className="size-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">
            Хүргэлт<span className="text-primary">.mn</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="relative gap-2"
            aria-label="Сагс"
          >
            <Link href="/cart">
              <ShoppingBag className="size-4" />
              <span className="hidden sm:inline">Сагс</span>
              {count > 0 && (
                <Badge className="ml-1 h-5 min-w-5 justify-center rounded-full px-1 text-[11px]">
                  {count}
                </Badge>
              )}
            </Link>
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus-visible:ring-ring flex cursor-pointer items-center gap-2 rounded-full border p-0.5 pr-2 transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:outline-none">
                  <Avatar>
                    <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                      {initials(user.full_name ?? user.email)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-24 truncate text-sm font-medium sm:block">
                    {user.full_name ?? user.email}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{user.full_name ?? 'Хэрэглэгч'}</span>
                    <span className="text-muted-foreground text-xs font-normal">{user.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/orders">
                    <Receipt /> Миний захиалга
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/favorites">
                    <Heart /> Дуртай ресторан
                  </Link>
                </DropdownMenuItem>
                {isAdmin && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/admin">
                        <LayoutDashboard /> Админ самбар
                      </Link>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={handleLogout}>
                  <LogOut /> Гарах
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">
                  <UserIcon className="size-4" /> Нэвтрэх
                </Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/register">Бүртгүүлэх</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MobileNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { count } = useCart();

  const items = [
    { href: '/', label: 'Нүүр', icon: UtensilsCrossed, badge: 0 },
    { href: '/orders', label: 'Захиалга', icon: Receipt, badge: 0 },
    { href: '/cart', label: 'Сагс', icon: ShoppingBag, badge: count },
    {
      href: user ? '/profile' : '/login',
      label: user ? 'Профайл' : 'Нэвтрэх',
      icon: UserIcon,
      badge: 0,
    },
  ];

  return (
    <nav className="bg-background/95 fixed inset-x-0 bottom-0 z-40 flex border-t backdrop-blur md:hidden">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'relative flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium',
              active ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon className="size-5" />
            {item.label}
            {item.href === '/cart' && item.badge > 0 && (
              <span className="bg-primary text-primary-foreground absolute top-1 right-4 flex size-4 items-center justify-center rounded-full text-[10px]">
                {item.badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
