// Client-side half of the pool-capacity guard (see src/lib/heats.ts).
//
// Every way of putting someone into a heat — dragging on the admin board, the
// "move to" menus, adding a name at the start line — calls the server action
// once; if it comes back saying the pool would be overfull, the person is asked
// and the action is retried with `force`. Going over the lane count stays
// possible (a shared lane, a heat full of no-shows), it just never happens
// silently. Anything other than an over-capacity answer is passed straight back
// to the caller.
type OverCapacity = { error: 'over-capacity'; total: number; capacity: number };

function isOverCapacity(result: unknown): result is OverCapacity {
  return !!result && typeof result === 'object' && (result as { error?: string }).error === 'over-capacity';
}

export async function withCapacityConfirm<T>(
  run: (force: boolean) => Promise<T>,
  confirmMessage: (over: OverCapacity) => string
): Promise<T | null> {
  const first = await run(false);
  if (!isOverCapacity(first)) return first;
  if (!window.confirm(confirmMessage(first))) return null;
  return run(true);
}
