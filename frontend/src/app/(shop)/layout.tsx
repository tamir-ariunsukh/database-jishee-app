import { Suspense } from 'react';
import { MobileNav, SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col">
      <Suspense fallback={<div className="h-16 border-b" />}>
        <SiteHeader />
      </Suspense>
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <SiteFooter />
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
