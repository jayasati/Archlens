'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { HotspotDto } from '@archlens/shared-types';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  hotspots: HotspotDto[];
}

export function HotspotList({ hotspots }: Props) {
  const [selected, setSelected] = useState<HotspotDto | null>(null);

  const sorted = hotspots.slice().sort((a, b) => b.riskScore - a.riskScore);

  return (
    <>
      <Card data-testid="hotspot-list">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Complexity</TableHead>
              <TableHead className="text-right">Churn</TableHead>
              <TableHead className="text-right">Smells</TableHead>
              <TableHead className="text-right">Risk</TableHead>
              <TableHead className="w-[1%]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No hotspots in this scan.
                </TableCell>
              </TableRow>
            ) : (
              sorted.map((h) => (
                <TableRow key={h.fileId} data-testid="hotspot-row">
                  <TableCell className="max-w-md truncate font-mono text-xs">{h.path}</TableCell>
                  <TableCell className="text-right">{h.complexity}</TableCell>
                  <TableCell className="text-right">{h.churn}</TableCell>
                  <TableCell className="text-right">{h.smellCount}</TableCell>
                  <TableCell className="text-right font-medium">{h.riskScore.toFixed(1)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      data-testid="suggest-refactor"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelected(h)}
                    >
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      Suggest refactor
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent data-testid="refactor-modal">
          <DialogHeader>
            <DialogTitle>Refactor suggestion</DialogTitle>
            <DialogDescription>
              {selected?.path ? `Suggested changes for ${selected.path}` : 'Suggested changes'}
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <p>
              An LLM-driven refactor plan will appear here in a future phase. For now this is a
              placeholder triggered by the row button.
            </p>
            {selected && (
              <ul className="mt-3 space-y-1 text-xs">
                <li>Complexity: {selected.complexity}</li>
                <li>Churn: {selected.churn}</li>
                <li>Risk score: {selected.riskScore.toFixed(2)}</li>
                <li>Smell count: {selected.smellCount}</li>
              </ul>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
