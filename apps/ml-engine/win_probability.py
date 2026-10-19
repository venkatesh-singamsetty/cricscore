"""
Format-agnostic cricket win-probability engine (1 to 20 overs).

Why this exists
---------------
The logistic-regression model is trained on 20-over (120-ball) Cricsheet data.
Re-scaling a short match onto a 120-ball scale (e.g. "need 18 off 5" becomes
"need 360 off 100") wipes out the huge variance of short innings and makes the
model output 0% / 100% far too early.

This module instead computes the probability *exactly* with dynamic
programming over every remaining legal delivery, using a per-ball outcome
distribution (dot, 1, 2, 3, 4, 6, wicket) that adapts to:
  * the required run rate (chasers attack when behind, rotate when cruising),
  * wickets lost (lower-order batters score fewer boundaries / get out more),
  * the stage of the innings and match length (1st innings).

Because the recursion works ball by ball it is naturally correct for ANY match
length up to MAX_BALLS, with no scaling hacks. Pure numpy, ~20ms cold, cached.
"""

from functools import lru_cache

import numpy as np

MAX_BALLS = 120  # 20 overs
MAX_RUNS = 400  # runs-needed / runs-scored grid size
RUN_VALUES = (0, 1, 2, 3, 4, 6)

# Per legal ball probabilities: [p0, p1, p2, p3, p4, p6, pWicket]
# Calibrated to typical T20 scoring (~1.25 runs/ball normal, ~7.5-8 RPO).
DEFENSIVE = np.array([0.38, 0.42, 0.08, 0.005, 0.08, 0.015, 0.02])
NORMAL = np.array([0.34, 0.38, 0.07, 0.005, 0.11, 0.045, 0.05])
AGGRESSIVE = np.array([0.33, 0.22, 0.05, 0.005, 0.17, 0.125, 0.10])

# Lower-order quality factor by wickets already lost (scales boundaries down,
# wicket risk up). Index = wickets lost (0..9).
TAIL_FACTOR = (1.0, 1.0, 1.0, 1.0, 1.0, 0.97, 0.92, 0.85, 0.75, 0.65)


def _apply_tail(profile: np.ndarray, wickets_lost: int) -> np.ndarray:
    k = TAIL_FACTOR[min(9, max(0, wickets_lost))]
    if k >= 1.0:
        return profile
    p = profile.copy()
    p[4] *= k
    p[5] *= k
    p[6] = min(0.5, p[6] * (2.0 - k))
    p[0] = max(0.0, 1.0 - (p[1:].sum()))
    return p / p.sum()


def _blend(a: np.ndarray, b: np.ndarray, t):
    """Linear blend; t may be scalar or a column vector."""
    return a * (1.0 - t) + b * t


def _chase_profiles(balls_left: int, wickets_lost: int) -> np.ndarray:
    """
    Outcome probabilities for every runs-needed value n (0..MAX_RUNS),
    shape (MAX_RUNS + 1, 7). Aggression depends on required runs per ball.
    """
    n = np.arange(MAX_RUNS + 1, dtype=float)
    rpb = n / max(1, balls_left)  # required runs per ball
    # 0.7 rpb -> DEFENSIVE, 1.3 -> NORMAL, >= 2.0 -> AGGRESSIVE
    t_low = np.clip((rpb - 0.7) / 0.6, 0.0, 1.0)[:, None]
    t_high = np.clip((rpb - 1.3) / 0.7, 0.0, 1.0)[:, None]
    low = _blend(_apply_tail(DEFENSIVE, wickets_lost), _apply_tail(NORMAL, wickets_lost), t_low)
    high = _blend(_apply_tail(NORMAL, wickets_lost), _apply_tail(AGGRESSIVE, wickets_lost), t_high)
    return np.where(rpb[:, None] <= 1.3, low, high)


@lru_cache(maxsize=1)
def _chase_table() -> np.ndarray:
    """
    V[b, w, n] = probability the chasing side wins with b legal balls left,
    w wickets lost and n runs still needed (n = target - score).
    n == 1 means scores are level -> a tie counts as 0.5.
    """
    V = np.zeros((MAX_BALLS + 1, 11, MAX_RUNS + 1))
    # Terminal states: no balls left or all out
    terminal = np.zeros(MAX_RUNS + 1)
    terminal[0] = 1.0
    terminal[1] = 0.5
    V[0, :, :] = terminal
    V[:, 10, :] = terminal

    for b in range(1, MAX_BALLS + 1):
        for w in range(9, -1, -1):
            probs = _chase_profiles(b, w)
            prev = V[b - 1, w]
            out = np.zeros(MAX_RUNS + 1)
            for i, r in enumerate(RUN_VALUES):
                if r == 0:
                    shifted = prev
                else:
                    shifted = np.concatenate([np.ones(r), prev[:-r]])
                out += probs[:, i] * shifted
            out += probs[:, 6] * V[b - 1, w + 1]
            out[0] = 1.0
            V[b, w] = out
    return V


def chase_win_probability(runs_needed: int, balls_left: int, wickets_lost: int) -> float:
    """Probability that the chasing (batting) side wins."""
    if runs_needed <= 0:
        return 1.0
    if wickets_lost >= 10 or balls_left <= 0:
        return 0.5 if runs_needed == 1 else 0.0
    if runs_needed > balls_left * 6 + 1:
        # Can't even tie without extras
        return 0.0
    b = min(MAX_BALLS, int(balls_left))
    n = min(MAX_RUNS, int(runs_needed))
    return float(_chase_table()[b, int(wickets_lost), n])


def _first_innings_profile(balls_left: int, total_balls: int, wickets_lost: int) -> np.ndarray:
    """Batting-first profile: more aggressive in short matches and at the death."""
    frac_left = balls_left / max(1, total_balls)
    base_intent = 0.2  # sides batting first play with intent throughout
    short_match_boost = 0.85 * max(0.0, 1.0 - total_balls / 60.0)
    death_boost = 0.6 * max(0.0, 1.0 - frac_left / 0.3)
    alpha = min(1.0, max(base_intent, short_match_boost, death_boost))
    if wickets_lost >= 7:
        alpha *= 0.5
    return _apply_tail(_blend(NORMAL, AGGRESSIVE, alpha), wickets_lost)


def first_innings_score_distribution(
    current_score: int, balls_left: int, wickets_lost: int, total_balls: int
) -> np.ndarray:
    """Probability distribution of the final 1st-innings total (index = runs)."""
    D = np.zeros((11, MAX_RUNS + 1))
    D[min(10, int(wickets_lost)), min(MAX_RUNS, int(current_score))] = 1.0
    for step in range(int(balls_left)):
        bl = int(balls_left) - step
        newD = np.zeros_like(D)
        newD[10] = D[10]  # all out is absorbing
        for w in range(10):
            row = D[w]
            if not row.any():
                continue
            p = _first_innings_profile(bl, total_balls, w)
            for i, r in enumerate(RUN_VALUES):
                if r == 0:
                    newD[w] += p[i] * row
                else:
                    shifted = np.concatenate([np.zeros(r), row[:-r]])
                    shifted[-1] += row[-r:].sum()  # clamp overflow at MAX_RUNS
                    newD[w] += p[i] * shifted
            newD[w + 1] += p[6] * row
        D = newD
    return D.sum(axis=0)


def first_innings_win_probability(
    current_score: int, balls_left: int, wickets_lost: int, total_balls: int
) -> float:
    """Probability that the side batting first wins the match."""
    total_balls = max(1, min(MAX_BALLS, int(total_balls)))
    balls_left = max(0, min(total_balls, int(balls_left)))
    dist = first_innings_score_distribution(current_score, balls_left, wickets_lost, total_balls)
    V = _chase_table()
    # Chaser needs (final + 1) with the full allocation and 10 wickets.
    needs = np.minimum(np.arange(MAX_RUNS + 1) + 1, MAX_RUNS)
    chase_probs = V[total_balls, 0, needs]
    return float(np.sum(dist * (1.0 - chase_probs)))


DLS_B = 0.027
FIFTY_OVER_ROW = (100.0, 93.4, 85.1, 74.9, 62.7, 49.0, 34.9, 22.0, 11.9, 4.7)


def _raw_z(u: float, f: float) -> float:
    if f <= 0.0:
        return 0.0
    return float(f * (1.0 - np.exp((-DLS_B * max(0.0, u)) / f)))


@lru_cache(maxsize=1)
def _f_by_wickets() -> tuple:
    z50 = _raw_z(50.0, 1.0)
    out = []
    for w, pct in enumerate(FIFTY_OVER_ROW):
        if w == 0:
            out.append(1.0)
            continue
        goal = (pct / 100.0) * z50
        lo, hi = 1e-6, 1.0
        for _ in range(80):
            mid = 0.5 * (lo + hi)
            if _raw_z(50.0, mid) < goal:
                lo = mid
            else:
                hi = mid
        out.append(0.5 * (lo + hi))
    return tuple(out)


def _dls_resource_remaining(balls_left: int, wickets_lost: int, total_balls: int) -> float:
    """Fraction of resources remaining (0..1), matching frontend dlsUtils.ts."""
    if wickets_lost >= 10 or balls_left <= 0 or total_balls <= 0:
        return 0.0
    f_table = _f_by_wickets()
    total_overs = total_balls / 6.0
    full = _raw_z(total_overs, f_table[0])
    if full <= 0.0:
        return 0.0
    u = min(max(0.0, balls_left / 6.0), total_overs)
    w = min(9, max(0, int(wickets_lost)))
    return float(np.clip(_raw_z(u, f_table[w]) / full, 0.0, 1.0))


def win_probability(
    inning: int,
    current_score: float,
    wickets_lost: float,
    balls_left: float,
    balls_bowled: float,
    target_score: float,
) -> float:
    """Batting side's win probability for any match length up to 20 overs."""
    cs = int(max(0, current_score))
    wk = int(min(10, max(0, wickets_lost)))
    bl = int(max(0, balls_left))
    bb = int(max(0, balls_bowled))
    total = int(max(1, bb + bl))
    if inning == 2 and target_score > 0:
        runs_needed = int(target_score) - cs
        raw_dp = chase_win_probability(runs_needed, bl, wk)
        if bb <= 0 or bl <= 0 or wk >= 10 or runs_needed <= 0 or runs_needed > bl * 6 + 1:
            return raw_dp

        # Align with DLS Par when the required run rate is physically achievable
        # (<= 2.3 runs/ball full weight, tapering to 0 by 3.0 runs/ball so extreme
        # equations like 18 off 5 remain governed by the physical ball-by-ball ceiling).
        rpb = runs_needed / float(bl)
        feasibility = float(np.clip((3.0 - rpb) / 0.7, 0.0, 1.0))
        if feasibility <= 0.0:
            return raw_dp

        team1_score = max(0.0, float(target_score) - 1.0)
        r_rem = _dls_resource_remaining(bl, wk, total)
        dls_par = np.floor(team1_score * (1.0 - r_rem))
        dls_diff = float(cs) - dls_par
        scale = max(1.6, np.sqrt(float(bl)) * 1.6)
        dls_prob = float(1.0 / (1.0 + np.exp(-dls_diff / scale)))

        dls_weight = 0.70 * feasibility * (1.0 - 0.5 * (wk / 10.0))
        return float((1.0 - dls_weight) * raw_dp + dls_weight * dls_prob)
    return first_innings_win_probability(cs, bl, wk, total)

