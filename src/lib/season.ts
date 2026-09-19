// Where a competition is in its life: under way, published, closed.
//
// Kept in one place because the answer is read from very different corners —
// the public results API, the admin's review panel, the home page, the Hall of
// Fame import — and they must all agree.

/**
 * Whether the public may see the rankings. Publishing results takes two
 * deliberate steps — the admin signs off on the timekeepers' numbers
 * (`resultsApproved`) and then puts them in front of the public
 * (`publicResultsVisible`) — because rankings are provisional until reviewed,
 * and a late substitution or a mis-stamped time is corrected before, not after,
 * the village reads it.
 */
export function resultsPubliclyVisible(
  settings: { publicResultsVisible: boolean; resultsApproved: boolean } | null
): boolean {
  return !!settings?.publicResultsVisible && !!settings?.resultsApproved;
}

/**
 * The year a competition belongs to: its own race date rather than today's, so
 * a season closed in December is still filed under the year it was raced, and
 * results read in January still say the right year.
 */
export function competitionYear(raceStartTime: Date | null | undefined): number {
  return (raceStartTime ?? new Date()).getFullYear();
}
