import type { Grade } from '@archlens/shared-types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GradeBadge } from './grade-badge';
import { formatScore } from '@/lib/utils/format';
import { gradeLabel } from '@/lib/utils/grade';

interface ScoreCardProps {
  score: number;
  grade: Grade;
  title?: string;
  subtitle?: string;
}

export function ScoreCard({ score, grade, title = 'Overall score', subtitle }: ScoreCardProps) {
  return (
    <Card data-testid="score-card">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">{title}</CardTitle>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex items-center justify-between">
        <div>
          <div className="text-5xl font-semibold tracking-tight" data-testid="score-value">
            {formatScore(score)}
            <span className="ml-1 text-xl text-muted-foreground">/100</span>
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{gradeLabel(grade)}</div>
        </div>
        <GradeBadge grade={grade} size="lg" />
      </CardContent>
    </Card>
  );
}
