import { encode } from 'gpt-tokenizer';
import type { ComponentContext, TokenEstimate } from './types.js';
import { formatContextMarkdown } from './formatter.js';

export class TokenEstimator {
  estimate(text: string): number {
    return encode(text).length;
  }

  estimateContext(context: ComponentContext): TokenEstimate {
    const minimal = this.estimate(formatContextMarkdown(context, 'minimal'));
    const standard = this.estimate(formatContextMarkdown(context, 'standard'));
    const full = this.estimate(formatContextMarkdown(context, 'full'));

    return {
      minimal,
      standard,
      full,
      current: context.contextLevel === 'minimal' ? minimal : context.contextLevel === 'standard' ? standard : full
    };
  }
}
