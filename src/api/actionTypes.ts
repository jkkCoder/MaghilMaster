// Typed Action Types
export function typedAction<T extends string>(type: T): { type: T };
export function typedAction<T extends string, P extends any>(
  type: T,
  payload: P
): { type: T; payload: P };

// Types Action Creator Function
export function typedAction(type: string, payload?: any) {
  return { type, payload };
}

