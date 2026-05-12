import { Card } from '@/components/ui/card';
import { GradeBadge } from './grade-badge';
import { scoreToGrade } from '@/lib/utils/grade';
import { formatScore } from '@/lib/utils/format';

interface RatingTileProps {
  label: string;
  score: number;
  /** Short label shown as a chip when the metric is "off" or "limited signal". */
  note?: string;
  /** Longer text explaining how the score was computed; renders as a `title=` tooltip. */
  derivation?: string;
}

export function RatingTile({ label, score, note, derivation }: RatingTileProps) {
  const grade = scoreToGrade(score);
  const titleText = derivation ? (note ? `${derivation}\n\nNote: ${note}` : derivation) : note;
  return (
    <Card className="p-4" data-testid="rating-tile" data-label={label} title={titleText}>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">{label}</div>
          <div className="mt-1 text-2xl font-semibold">{formatScore(score)}</div>
          {note ? (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
              {note.length > 32 ? `${note.slice(0, 32)}…` : note}
            </div>
          ) : null}
        </div>
        <GradeBadge grade={grade} size="md" />
      </div>
    </Card>
  );
}
