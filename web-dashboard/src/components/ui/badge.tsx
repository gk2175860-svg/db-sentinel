import { cn } from '@/lib/utils';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
        {
          'bg-db-primary text-db-text hover:bg-db-primary/80': variant === 'default',
          'bg-db-secondary text-db-text hover:bg-db-secondary/80': variant === 'secondary',
          'bg-db-critical text-db-text hover:bg-db-critical/80': variant === 'destructive',
          'border border-db-secondary bg-transparent hover:bg-db-secondary': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  );
}