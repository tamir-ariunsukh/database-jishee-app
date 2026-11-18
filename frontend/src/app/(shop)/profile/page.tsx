'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  LayoutDashboard,
  LogOut,
  MapPin,
  Pencil,
  Plus,
  Star,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { api, errorMessage } from '@/lib/api';
import { initials, ROLE_LABELS } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import type { Address } from '@/lib/types';

interface AddressForm {
  title: string;
  address: string;
  apartment: string;
  entrance: string;
  floor: string;
  is_default: boolean;
}

const EMPTY_ADDRESS: AddressForm = {
  title: 'Гэр',
  address: '',
  apartment: '',
  entrance: '',
  floor: '',
  is_default: false,
};

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, loading: authLoading, refreshUser, logout, isAdmin } = useAuth();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '' });

  const [addressOpen, setAddressOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(EMPTY_ADDRESS);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<Address | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.replace('/login');
  }, [authLoading, user, router]);

  const loadAddresses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api<{ data: Address[] }>('/addresses', { token });
      setAddresses(res.data);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) void loadAddresses();
  }, [token, loadAddresses]);

  const openProfile = () => {
    setProfileForm({ full_name: user?.full_name ?? '', phone: user?.phone ?? '' });
    setProfileOpen(true);
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      await api('/auth/me', {
        method: 'PATCH',
        token,
        body: {
          full_name: profileForm.full_name.trim(),
          phone: profileForm.phone.trim() || null,
        },
      });
      await refreshUser();
      setProfileOpen(false);
      toast.success('Профайл шинэчлэгдлээ');
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const openCreateAddress = () => {
    setEditingAddress(null);
    setAddressForm({ ...EMPTY_ADDRESS, is_default: addresses.length === 0 });
    setAddressOpen(true);
  };

  const openEditAddress = (address: Address) => {
    setEditingAddress(address);
    setAddressForm({
      title: address.title ?? 'Гэр',
      address: address.address,
      apartment: address.apartment ?? '',
      entrance: address.entrance ?? '',
      floor: address.floor ?? '',
      is_default: address.is_default,
    });
    setAddressOpen(true);
  };

  const saveAddress = async () => {
    if (addressForm.address.trim().length < 3) {
      toast.error('Хаягаа дэлгэрэнгүй оруулна уу');
      return;
    }
    setSaving(true);
    try {
      const body = {
        title: addressForm.title.trim() || null,
        address: addressForm.address.trim(),
        apartment: addressForm.apartment.trim() || null,
        entrance: addressForm.entrance.trim() || null,
        floor: addressForm.floor.trim() || null,
        is_default: addressForm.is_default,
      };
      if (editingAddress) {
        await api(`/addresses/${editingAddress.id}`, { method: 'PUT', token, body });
        toast.success('Хаяг шинэчлэгдлээ');
      } else {
        await api('/addresses', { method: 'POST', token, body });
        toast.success('Хаяг нэмэгдлээ');
      }
      setAddressOpen(false);
      await loadAddresses();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const makeDefault = async (address: Address) => {
    try {
      await api(`/addresses/${address.id}/default`, { method: 'POST', token });
      await loadAddresses();
      toast.success('Үндсэн хаяг солигдлоо');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const removeAddress = async (address: Address) => {
    try {
      await api(`/addresses/${address.id}`, { method: 'DELETE', token });
      await loadAddresses();
      toast.success('Хаяг устгагдлаа');
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  if (authLoading || !user) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-10">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-semibold tracking-tight">Миний профайл</h1>

      <Card>
        <CardContent className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center">
          <Avatar className="size-16">
            <AvatarFallback className="bg-primary/15 text-primary text-xl font-semibold">
              {initials(user.full_name ?? user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg font-semibold">{user.full_name ?? 'Хэрэглэгч'}</p>
              <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
            </div>
            <p className="text-muted-foreground text-sm">{user.email}</p>
            <p className="text-muted-foreground text-sm">{user.phone ?? 'Утас бүртгээгүй'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={openProfile}>
              <Pencil className="size-4" /> Засах
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                logout();
                router.push('/');
              }}
            >
              <LogOut className="size-4" /> Гарах
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Link href="/orders">
          <Card className="hover:bg-accent/50 h-full py-4 transition-colors">
            <CardContent className="flex items-center gap-2 px-4 text-sm">
              <Star className="text-primary size-4" /> Миний захиалга
            </CardContent>
          </Card>
        </Link>
        <Link href="/favorites">
          <Card className="hover:bg-accent/50 h-full py-4 transition-colors">
            <CardContent className="flex items-center gap-2 px-4 text-sm">
              <Star className="text-rose-500 size-4" /> Дуртай ресторан
            </CardContent>
          </Card>
        </Link>
        {(isAdmin || user.role === 'driver') && (
          <Link href="/admin">
            <Card className="hover:bg-accent/50 h-full py-4 transition-colors">
              <CardContent className="flex items-center gap-2 px-4 text-sm">
                <LayoutDashboard className="text-primary size-4" /> Админ самбар
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="text-primary size-4" /> Хүргэлтийн хаягууд
          </CardTitle>
          <Button variant="outline" size="sm" onClick={openCreateAddress}>
            <Plus className="size-4" /> Нэмэх
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : addresses.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm">
              Хаяг бүртгээгүй байна.
            </div>
          ) : (
            addresses.map((address) => (
              <div
                key={address.id}
                className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{address.title ?? 'Хаяг'}</p>
                    {address.is_default && <Badge variant="success">Үндсэн</Badge>}
                  </div>
                  <p className="text-muted-foreground text-sm">{address.address}</p>
                  {(address.apartment || address.entrance || address.floor) && (
                    <p className="text-muted-foreground text-xs">
                      {[
                        address.apartment && `Тоот ${address.apartment}`,
                        address.entrance && `Орц ${address.entrance}`,
                        address.floor && `Давхар ${address.floor}`,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!address.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => makeDefault(address)}>
                      Үндсэн болгох
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" onClick={() => openEditAddress(address)}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleting(address)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="text-muted-foreground mt-6 flex items-center gap-2 text-xs">
        <CreditCard className="size-3.5" />
        Төлбөрийн мэдээлэл захиалга бүр дээр хийгдэнэ.
      </div>

      {/* Profile dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserIcon className="size-4" /> Профайл засах
            </DialogTitle>
            <DialogDescription>Нэр, утасны дугаараа шинэчилнэ үү.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Овог нэр</Label>
              <Input
                value={profileForm.full_name}
                onChange={(event) => setProfileForm({ ...profileForm, full_name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Утас</Label>
              <Input
                value={profileForm.phone}
                onChange={(event) => setProfileForm({ ...profileForm, phone: event.target.value })}
                placeholder="9911 2233"
              />
            </div>
            <Separator />
            <p className="text-muted-foreground text-xs">И-мэйл: {user.email}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProfileOpen(false)}>
              Цуцлах
            </Button>
            <Button onClick={saveProfile} disabled={saving}>
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address dialog */}
      <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAddress ? 'Хаяг засах' : 'Хаяг нэмэх'}</DialogTitle>
            <DialogDescription>Хүргэлт хийх хаягаа оруулна уу.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Хаягийн нэр</Label>
              <Input
                value={addressForm.title}
                onChange={(event) => setAddressForm({ ...addressForm, title: event.target.value })}
                placeholder="Гэр, Ажил..."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Хаяг</Label>
              <Input
                value={addressForm.address}
                onChange={(event) => setAddressForm({ ...addressForm, address: event.target.value })}
                placeholder="Дүүрэг, хороо, гудамж, байр..."
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label>Тоот</Label>
                <Input
                  value={addressForm.apartment}
                  onChange={(event) =>
                    setAddressForm({ ...addressForm, apartment: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Орц</Label>
                <Input
                  value={addressForm.entrance}
                  onChange={(event) =>
                    setAddressForm({ ...addressForm, entrance: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>Давхар</Label>
                <Input
                  value={addressForm.floor}
                  onChange={(event) => setAddressForm({ ...addressForm, floor: event.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Үндсэн хаяг</Label>
              <Switch
                checked={addressForm.is_default}
                onCheckedChange={(checked) => setAddressForm({ ...addressForm, is_default: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressOpen(false)}>
              Цуцлах
            </Button>
            <Button onClick={saveAddress} disabled={saving}>
              Хадгалах
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Хаягийг устгах уу?"
        description="Энэ хаяг таны бүртгэлээс устах болно."
        onConfirm={() => (deleting ? removeAddress(deleting) : undefined)}
      />
    </div>
  );
}
