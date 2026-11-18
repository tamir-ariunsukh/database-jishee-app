'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/providers';

const DEMO_ACCOUNTS = [
  { label: 'Хэрэглэгч', email: 'customer@delivery.mn', password: 'Customer123!' },
  { label: 'Админ', email: 'admin@delivery.mn', password: 'Admin123!' },
  { label: 'Хүргэгч', email: 'driver@delivery.mn', password: 'Driver123!' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      toast.success(`Тавтай морил, ${user.full_name ?? user.email}!`);
      router.push(user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/admin/deliveries' : '/orders');
    } catch (error) {
      toast.error(errorMessage(error));
      setSubmitting(false);
    }
  };

  const quickLogin = async (account: (typeof DEMO_ACCOUNTS)[number]) => {
    setEmail(account.email);
    setPassword(account.password);
    setSubmitting(true);
    try {
      const user = await login(account.email, account.password);
      toast.success(`Тавтай морил, ${user.full_name ?? user.email}!`);
      router.push(user.role === 'admin' ? '/admin' : user.role === 'driver' ? '/admin/deliveries' : '/orders');
    } catch (error) {
      toast.error(errorMessage(error));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-4xl items-center gap-8 px-4 py-12 md:grid-cols-2">
      <div className="hidden md:block">
        <div className="bg-primary text-primary-foreground flex size-12 items-center justify-center rounded-2xl">
          <UtensilsCrossed className="size-6" />
        </div>
        <h1 className="mt-5 text-3xl font-bold tracking-tight">
          Дахин тавтай морил!
        </h1>
        <p className="text-muted-foreground mt-3">
          Нэвтэрснээр захиалгаа хянах, хаягаа хадгалах, дуртай ресторанаа удирдах боломжтой.
        </p>
        <div className="mt-8 space-y-2 rounded-xl border bg-card p-4 text-sm">
          <p className="font-medium">Туршилтын бүртгэлүүд:</p>
          {DEMO_ACCOUNTS.map((account) => (
            <div key={account.email} className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">{account.label}</span>
              <code className="text-xs">{account.email}</code>
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Нэвтрэх</CardTitle>
          <CardDescription>И-мэйл, нууц үгээ оруулна уу.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Нууц үг</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
              Нэвтрэх
            </Button>
          </form>

          <div className="my-4 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-muted-foreground text-xs">эсвэл шууд нэвтрэх</span>
            <Separator className="flex-1" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DEMO_ACCOUNTS.map((account) => (
              <Button
                key={account.email}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => quickLogin(account)}
                disabled={submitting}
              >
                {account.label}
              </Button>
            ))}
          </div>

          <p className="text-muted-foreground mt-6 text-center text-sm">
            Бүртгэл байхгүй юу?{' '}
            <Link href="/register" className="text-primary font-medium hover:underline">
              Бүртгүүлэх
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
