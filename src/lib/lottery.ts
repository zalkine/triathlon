import type { Leg } from './constants';

export type LotteryCandidate = {
  registrantId: string;
  name: string;
  legs: Leg[];
};

export type LotteryTeam = {
  swim: LotteryCandidate;
  bike: LotteryCandidate;
  run: LotteryCandidate;
};

export type LotteryResult = {
  teams: LotteryTeam[];
  leftover: LotteryCandidate[];
};

function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const ALL_LEGS: Leg[] = ['SWIM', 'BIKE', 'RUN'];

/**
 * Greedily forms swim+bike+run teams from candidates who each marked one or
 * more legs they're willing to do. Shuffles first (it's a lottery), then on
 * each round fills the currently scarcest leg role first — this reduces how
 * many people who only marked a single leg end up unmatched, at the cost of
 * not guaranteeing a maximum-size matching. Anyone left over when no full
 * team can be formed is returned for the admin to place manually.
 */
export function runLottery(candidates: LotteryCandidate[]): LotteryResult {
  let pool = shuffle(candidates);
  const teams: LotteryTeam[] = [];

  while (true) {
    const pools: Record<Leg, LotteryCandidate[]> = {
      SWIM: pool.filter((c) => c.legs.includes('SWIM')),
      BIKE: pool.filter((c) => c.legs.includes('BIKE')),
      RUN: pool.filter((c) => c.legs.includes('RUN')),
    };

    if (pools.SWIM.length === 0 || pools.BIKE.length === 0 || pools.RUN.length === 0) break;

    const legsByScarcity = [...ALL_LEGS].sort((a, b) => pools[a].length - pools[b].length);
    const picked: Partial<Record<Leg, LotteryCandidate>> = {};
    const used = new Set<string>();

    for (const leg of legsByScarcity) {
      const candidate = pools[leg].find((c) => !used.has(c.registrantId));
      if (!candidate) break;
      picked[leg] = candidate;
      used.add(candidate.registrantId);
    }

    if (!picked.SWIM || !picked.BIKE || !picked.RUN) break;

    teams.push({ swim: picked.SWIM, bike: picked.BIKE, run: picked.RUN });
    pool = pool.filter((c) => !used.has(c.registrantId));
  }

  return { teams, leftover: pool };
}
