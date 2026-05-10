import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { CloneStep } from './steps/01-clone.step';
import { DetectLanguagesStep } from './steps/02-detect-languages.step';
import { RunAdaptersStep } from './steps/03-run-adapters.step';
import { ComputeMetricsStep } from './steps/04-compute-metrics.step';
import { BuildGraphStep } from './steps/05-build-graph.step';
import { ScoreStep } from './steps/06-score.step';
import { RenderDiagramsStep } from './steps/07-render-diagrams.step';
import { PersistStep } from './steps/08-persist.step';

@Module({
  providers: [
    PipelineService,
    CloneStep,
    DetectLanguagesStep,
    RunAdaptersStep,
    ComputeMetricsStep,
    BuildGraphStep,
    ScoreStep,
    RenderDiagramsStep,
    PersistStep,
  ],
  exports: [PipelineService],
})
export class PipelineModule {}
