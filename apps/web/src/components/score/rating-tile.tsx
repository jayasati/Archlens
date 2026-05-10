import { Card } from '@/components/ui/card';
import { GradeBadge } from './grade-badge';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore } from '@/lib/utils/format';

interface RatingTileProps {
  label: string;
  score: number;
}

export function RatingTile({ label, score }: RatingTileProps) {
  const grade = scoreToGrade(score);
  return (
    <Card className="p-4" data-testid="rating-tile" data-label={label}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{formatScore(score)}</div>
        </div>
        <GradeBadge grade={grade} size="md" />
      </div>
    </Card>
  );
}
