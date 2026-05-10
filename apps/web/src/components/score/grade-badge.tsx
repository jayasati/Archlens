import type { Grade } from '@archlens/shared-types';
import { cn } from '@/lib/utils/cn';
import { gradeColor } from '@/lib/utils/grade';

interface GradeBadgeProps {
  grade: Grade;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function GradeBadge({ grade, size = 'md', className }: GradeBadgeProps) {
  const colors = gradeColor(grade);
  const sizeClass =
    size === 'sm' ? 'h-7 w-7 text-sm' : size === 'lg' ? 'h-14 w-14 text-2xl' : 'h-9 w-9 text-base';

  return (
    <div
      data-testid="grade-badge"
      data-grade={grade}
      className={cn(
        'inline-flex items-center justify-center rounded-md font-bold text-white ring-2 ring-offset-2 ring-offset-background',
        colors.bg,
        colors.ring,
        sizeClass,
        className
      )}
    >
      {grade}
    </div>
  );
}
