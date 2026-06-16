import { describe, it, expect } from 'vitest';
import { ExtraType, WicketType } from '../types';

/**
 * Unit tests for core cricket scoring type enumerations.
 * These validate that the enums used throughout the scoring engine
 * have the correct string values — important because they are persisted
 * to localStorage and sent to the backend API.
 */
describe('ExtraType enum', () => {
  it('has NONE value', () => {
    expect(ExtraType.NONE).toBe('NONE');
  });

  it('has WIDE value', () => {
    expect(ExtraType.WIDE).toBe('WIDE');
  });

  it('has NO_BALL value', () => {
    expect(ExtraType.NO_BALL).toBe('NO_BALL');
  });

  it('has BYE value', () => {
    expect(ExtraType.BYE).toBe('BYE');
  });

  it('has LEG_BYE value', () => {
    expect(ExtraType.LEG_BYE).toBe('LEG_BYE');
  });
});

describe('WicketType enum', () => {
  it('has NONE value', () => {
    expect(WicketType.NONE).toBe('NONE');
  });

  it('has BOWLED value', () => {
    expect(WicketType.BOWLED).toBe('BOWLED');
  });

  it('has CAUGHT value', () => {
    expect(WicketType.CAUGHT).toBe('CAUGHT');
  });

  it('has LBW value', () => {
    expect(WicketType.LBW).toBe('LBW');
  });

  it('has RUN_OUT value', () => {
    expect(WicketType.RUN_OUT).toBe('RUN_OUT');
  });

  it('has STUMPED value', () => {
    expect(WicketType.STUMPED).toBe('STUMPED');
  });

  it('has HIT_WICKET value', () => {
    expect(WicketType.HIT_WICKET).toBe('HIT_WICKET');
  });

  it('has RETIRED_HURT value (Not Out — continues batting)', () => {
    expect(WicketType.RETIRED_HURT).toBe('RETIRED_HURT');
  });

  it('has RETIRED_OUT value (counts as a wicket)', () => {
    expect(WicketType.RETIRED_OUT).toBe('RETIRED_OUT');
  });
});

describe('WicketType retirement logic', () => {
  it('RETIRED_HURT is distinct from RETIRED_OUT', () => {
    expect(WicketType.RETIRED_HURT).not.toBe(WicketType.RETIRED_OUT);
  });
});
