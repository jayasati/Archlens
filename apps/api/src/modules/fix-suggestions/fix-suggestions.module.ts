import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module';
import { AzureOpenAiClient } from './azure-openai.client';
import { FixSuggestionsController } from './fix-suggestions.controller';
import { FixSuggestionsService } from './fix-suggestions.service';
import { PromptBuilder } from './prompt-builder';

@Module({
  imports: [ReportsModule],
  controllers: [FixSuggestionsController],
  providers: [FixSuggestionsService, AzureOpenAiClient, PromptBuilder],
})
export class FixSuggestionsModule {}
