import * as React from 'react';
import { cn } from '@/lib/utils/cn';

const Separator = ({ className, orientation = 'horizontal', ...props }: React.HTMLAttributes<HTMLDivElement> & { orientation?: 'horizontal' | 'vertical' }) => (
  <div
    className={cn(
      'bg-white/10',
      orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
      className
    )}
    role="separator"
    aria-orientation={orientation}
    {...props}
  />
);

Separator.displayName = 'Separator';

export { Separator };
