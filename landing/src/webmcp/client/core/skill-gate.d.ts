export const GATED_TOOLS: Record<string, readonly string[]>;
export function markSkillRead(name: string): void;
export function wasSkillRead(name: string): boolean;
export function requireSkill(name: string): void;
