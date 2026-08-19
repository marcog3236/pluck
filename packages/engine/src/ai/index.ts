// ── AI module — public API ──

export type { AIStrategy, AIDifficulty } from './types.js';
export { EasyAI } from './easy.js';
export { MediumAI } from './medium.js';
export { HardAI } from './hard.js';

import type { AIStrategy, AIDifficulty } from './types.js';
import { EasyAI } from './easy.js';
import { MediumAI } from './medium.js';
import { HardAI } from './hard.js';

/** Factory: get an AI strategy by difficulty */
export function createAI(difficulty: AIDifficulty): AIStrategy {
  switch (difficulty) {
    case 'easy': return new EasyAI();
    case 'medium': return new MediumAI();
    case 'hard': return new HardAI();
  }
}
