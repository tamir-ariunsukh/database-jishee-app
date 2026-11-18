import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Stars({
  value,
  className,
  size = 'size-3.5',
}: {
  value: number;
  className?: string;
  size?: string;
}) {
  const rounded = Math.round(value);
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${value} / 5`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Star
          key={index}
          className={cn(
            size,
            index < rounded ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/35',
          )}
        />
      ))}
    </div>
  );
}
