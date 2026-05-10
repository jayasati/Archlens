'use client';

import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { HotspotDto } from '@archlens/shared-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  hotspots: HotspotDto[];
}

export function HotspotScatter({ hotspots }: Props) {
  const data = hotspots.map((h) => ({
    x: h.churn,
    y: h.complexity,
    z: Math.max(20, h.riskScore * 6),
    path: h.path,
    smells: h.smellCount,
    risk: h.riskScore,
  }));

  return (
    <Card data-testid="hotspot-scatter">
      <CardHeader>
        <CardTitle className="text-base font-medium text-muted-foreground">
          Risk map · churn × complexity
        </CardTitle>
      </CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No hotspots in this scan.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                type="number"
                dataKey="x"
                name="Churn"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                label={{ value: 'Churn', position: 'insideBottom', offset: -2, fontSize: 11 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Complexity"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                label={{
                  value: 'Complexity',
                  angle: -90,
                  position: 'insideLeft',
                  fontSize: 11,
                }}
              />
              <ZAxis type="number" dataKey="z" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const p = payload[0]?.payload as (typeof data)[number] | undefined;
                  if (!p) return null;
                  return (
                    <div className="rounded-md border bg-background px-3 py-2 text-xs shadow-md">
                      <div className="font-mono font-medium">{p.path}</div>
                      <div className="mt-1 text-muted-foreground">
                        complexity {p.y} · churn {p.x} · smells {p.smells} · risk{' '}
                        {p.risk.toFixed(1)}
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={data} fill="hsl(0 84% 60% / 0.7)" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
