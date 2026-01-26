const DEFAULT_MODEL_SWITCH_CONTEXT_TURNS = 3;
const MIN_MODEL_SWITCH_CONTEXT_TURNS = 1;
const MAX_MODEL_SWITCH_CONTEXT_TURNS = 6;

export function getModelSwitchContextTurns(): number {
  const rawValue = process.env.MODEL_SWITCH_CONTEXT_TURNS;
  const parsed = rawValue ? Number.parseInt(rawValue, 10) : NaN;
  const fallback = DEFAULT_MODEL_SWITCH_CONTEXT_TURNS;

  if (Number.isNaN(parsed)) {
    return fallback;
  }

  return Math.min(
    MAX_MODEL_SWITCH_CONTEXT_TURNS,
    Math.max(MIN_MODEL_SWITCH_CONTEXT_TURNS, parsed)
  );
}
