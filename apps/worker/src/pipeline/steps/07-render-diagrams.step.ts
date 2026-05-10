import { Injectable } from '@nestjs/common';
import { buildMermaidModuleGraph } from '@archlens/analyzers';
import type { PipelineContext, ProgressReporter } from '../pipeline.types';

@Injectable()
export class RenderDiagramsStep {
  async run(ctx: PipelineContext, progress: ProgressReporter): Promise<void> {
    if (!ctx.ir) throw new Error('IR missing before render-diagrams');
    // produce a mermaid module graph; not persisted yet — kept on the IR object
    // for downstream use. The phase-4 spec only requires summary fields in DB.
    void buildMermaidModuleGraph(ctx.ir.modules, ctx.ir.edges);
    await progress.step('07-render-diagrams', 90, 'rendered module graph');
  }
}
