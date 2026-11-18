'use client';

import { useState } from 'react';
import { Search, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { EmptyState, PageHeader } from '@/components/admin/page-header';
import { Stars } from '@/components/stars';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useAuth } from '@/lib/providers';
import { useList } from '@/lib/use-list';
import type { Review } from '@/lib/types';

export default function AdminReviewsPage() {
  const { token } = useAuth();
  const [query, setQuery] = useState('');
  const { data: reviews, loading, reload } = useList<Review>('/reviews?limit=100');
  const [deleting, setDeleting] = useState<Review | null>(null);

  const filtered = query
    ? reviews.filter(
        (review) =>
          (review.full_name ?? '').toLowerCase().includes(query.toLowerCase()) ||
          (review.comment ?? '').toLowerCase().includes(query.toLowerCase()) ||
          (review.restaurant_name ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : reviews;

  const remove = async (review: Review) => {
    try {
      await api(`/reviews/${review.id}`, { method: 'DELETE', token });
      toast.success('Үнэлгээ устгагдлаа');
      await reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const average = reviews.length
    ? (reviews.reduce((sum, review) => sum + Number(review.rating), 0) / reviews.length).toFixed(1)
    : '0';

  return (
    <div>
      <PageHeader
        title="Үнэлгээ"
        description="Хэрэглэгчдийн сэтгэгдэл, одны үнэлгээ."
        actions={
          <Badge variant="secondary" className="gap-1 py-1.5">
            <Star className="size-3.5 fill-amber-400 text-amber-400" /> Дундаж {average}
          </Badge>
        }
      />

      <Card className="py-0">
        <div className="flex flex-wrap items-center gap-2 border-b p-3">
          <div className="relative min-w-52 flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Хэрэглэгч, ресторан, сэтгэгдэл..."
              className="pl-9"
            />
          </div>
          <Badge variant="secondary">{filtered.length} үнэлгээ</Badge>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Үнэлгээ байхгүй" description="Хүргэгдсэн захиалгын дараа үнэлгээ гарч ирнэ." />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Хэрэглэгч</TableHead>
                <TableHead>Ресторан</TableHead>
                <TableHead>Үнэлгээ</TableHead>
                <TableHead>Сэтгэгдэл</TableHead>
                <TableHead>Огноо</TableHead>
                <TableHead className="pr-4 text-right">Үйлдэл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((review) => (
                <TableRow key={review.id}>
                  <TableCell className="pl-4 font-medium">{review.full_name ?? 'Хэрэглэгч'}</TableCell>
                  <TableCell className="text-sm">{review.restaurant_name ?? '—'}</TableCell>
                  <TableCell>
                    <Stars value={review.rating} />
                  </TableCell>
                  <TableCell className="text-muted-foreground max-w-80 truncate text-sm">
                    {review.comment ?? '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatDateTime(review.created_at)}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleting(review)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Үнэлгээг устгах уу?"
        description="Энэ үйлдлийг буцаах боломжгүй."
        onConfirm={() => (deleting ? remove(deleting) : undefined)}
      />
    </div>
  );
}
