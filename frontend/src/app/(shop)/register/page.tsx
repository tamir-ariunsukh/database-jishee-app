'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, UserPlus, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/providers';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [form, setForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const update = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (form.password !== form.confirm) {
      toast.error('Нууц үгүүд тохирохгүй байна');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Нууц үг хамгийн багадаа 6 тэмдэгт байх ёстой');
      return;
    }
    setSubmitting(true);
    try {
      const user = await register({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
      });
      toast.success(`Бүртгэл амжилттай, ${user.full_name}!`);
      router.push('/');
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
        <h1 className="mt-5 text-3xl font-bold tracking-tight">Бүртгүүлэх</h1>
        <p className="text-muted-foreground mt-3">
          30 секундэд бүртгүүлээд эхний захиалгаа хийгээрэй. Таны мэдээлэл зөвхөн захиалга хүргэхэд
          ашиглагдана.
        </p>
        <ul className="text-muted-foreground mt-6 space-y-2 text-sm">
          <li>✓ Хүргэлтийн хаягаа хадгалах</li>
          <li>✓ Захиалгын түүхээ хянах</li>
          <li>✓ Дуртай ресторанаа хадгалах</li>
          <li>✓ Купон ашиглах</li>
        </ul>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Шинэ бүртгэл</CardTitle>
          <CardDescription>Мэдээллээ бөглөнө үү.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Овог нэр</Label>
              <Input
                id="full_name"
                value={form.full_name}
                onChange={update('full_name')}
                placeholder="Батбаяр Эрдэнэ"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">И-мэйл</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Утас</Label>
              <Input
                id="phone"
                value={form.phone}
                onChange={update('phone')}
                placeholder="9911 2233"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="password">Нууц үг</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={update('password')}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Нууц үг давтах</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={form.confirm}
                  onChange={update('confirm')}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <UserPlus className="size-4" />
              )}
              Бүртгүүлэх
            </Button>
          </form>
          <p className="text-muted-foreground mt-6 text-center text-sm">
            Бүртгэл байгаа юу?{' '}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Нэвтрэх
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
