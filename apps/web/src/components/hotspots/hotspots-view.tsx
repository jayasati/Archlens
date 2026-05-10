'use client';

import { useHotspots } from '@/hooks/use-hotspots';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HotspotScatter } from './hotspot-scatter';
import { HotspotList } from './hotspot-list';

interface Props {
  scanId: string;
}

export function HotspotsView({ scanId }: Props) {
  const { data, isLoading, isError, error } = useHotspots(scanId);

  if (isLoading) {
    return (
      <Card data-testid="hotspots-loading">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Loading hotspots…</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card data-testid="hotspots-error">
        <CardHeader>
          <CardTitle className="text-base text-destructive">Failed to load hotspots</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {error instanceof Error ? error.message : 'Unknown error'}
        </CardContent>
      </Card>
    );
  }

  const hotspots = data ?? [];

  return (
    <div className="space-y-6" data-testid="hotspots-view">
      <HotspotScatter hotspots={hotspots} />
      <HotspotList hotspots={hotspots} />
    </div>
  );
}
