export enum MatchStatus {
  SETUP = 'SETUP',
  LIVE = 'LIVE',
  INNINGS_BREAK = 'INNINGS_BREAK',
  COMPLETED = 'COMPLETED'
}

export enum ExtraType {
  NONE = 'NONE',
  WIDE = 'WIDE',
  NO_BALL = 'NO_BALL',
  BYE = 'BYE',
  LEG_BYE = 'LEG_BYE'
}

export enum WicketType {
  NONE = 'NONE',
  BOWLED = 'BOWLED',
  CAUGHT = 'CAUGHT',
  LBW = 'LBW',
  RUN_OUT = 'RUN_OUT',
  STUMPED = 'STUMPED',
  HIT_WICKET = 'HIT_WICKET',
  RETIRED_HURT = 'RETIRED_HURT',
  RETIRED_OUT = 'RETIRED_OUT'
}

export interface Player {
  id: string;
  name: string;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  wicketBy?: string; // Bowler name
  wicketType?: WicketType;
  fielderName?: string;
}

export interface Bowler {
  id: string;
  name: string;
  overs: number; // Completed overs
  balls: number; // Balls in current over
  maidens: number;
  runsConceded: number;
  wickets: number;
}

export interface BallEvent {
  id: string;
  bowlerName: string;
  batterName: string;
  runs: number; // Runs off the bat (or extras if not wide/nb)
  isExtra: boolean;
  extraType: ExtraType;
  extraRuns: number; // The penalty run (e.g., 1 for WD)
  isWicket: boolean;
  wicketType: WicketType;
  fielderName?: string;
  commentary?: string;
  overNumber: number;
  ballNumber: number; // Ball within the over (valid balls only)
}

export interface InningsState {
  id: string; // Dynamic ID from Aiven
  inningNumber: 1 | 2;
  target?: number;
  battingTeamName: string;
  bowlingTeamName: string;
  totalRuns: number;
  totalWickets: number;
  overs: number; // Completed overs
  balls: number; // Balls in current over
  currentOver: BallEvent[];
  allBalls: BallEvent[];
  strikerId: string;
  nonStrikerId: string;
  currentBowlerId: string;
  players: Record<string, Player>;
  bowlers: Record<string, Bowler>;
  battingOrder: string[]; // List of player IDs
  bowlingOrder: string[]; // List of bowler IDs
}

export interface TeamData {
  name: string;
  players: string[]; // Array of names
}

export interface MatchState {
  status: MatchStatus;
  oversPerInnings: number;
  currentInnings: InningsState;
  previousInnings?: InningsState;
  winner?: string;
  teams: {
    teamA: TeamData;
    teamB: TeamData;
  }
}