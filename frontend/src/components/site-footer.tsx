import Link from 'next/link';
import { UtensilsCrossed } from 'lucide-react';

// Evaluated once at module load, keeps the render pure for Cache Components.
const CURRENT_YEAR = new Date().getFullYear();

export function SiteFooter() {
  return (
    <footer className="bg-muted/40 mt-16 border-t pb-20 md:pb-0">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
              <UtensilsCrossed className="size-4" />
            </span>
            <span className="font-semibold">Хүргэлт.mn</span>
          </div>
          <p className="text-muted-foreground text-sm">
            Улаанбаатарын шилдэг ресторануудын хоолыг гэртээ хүргэж өгнө.
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Үйлчилгээ</p>
          <Link href="/" className="text-muted-foreground hover:text-foreground block">
            Ресторанууд
          </Link>
          <Link href="/orders" className="text-muted-foreground hover:text-foreground block">
            Миний захиалга
          </Link>
          <Link href="/favorites" className="text-muted-foreground hover:text-foreground block">
            Дуртай ресторан
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Тусламж</p>
          <p className="text-muted-foreground">Хүргэлт: 10:00 – 22:00</p>
          <p className="text-muted-foreground">Утас: 7700 1234</p>
          <p className="text-muted-foreground">И-мэйл: help@hurgelet.mn</p>
        </div>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Төлбөр</p>
          <p className="text-muted-foreground">Бэлэн мөнгө, банкны карт, QPay</p>
          <p className="text-muted-foreground">Купон: WELCOME10, DELIVERY5000</p>
        </div>
      </div>
      <div className="text-muted-foreground border-t px-4 py-4 text-center text-xs">
        © {CURRENT_YEAR} Хүргэлт.mn · Express + PostgreSQL + Next.js + shadcn/ui
      </div>
    </footer>
  );
}
