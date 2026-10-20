import { describe, expect, it } from 'vitest';
import { getDateInTimeZone, getWeekdayInTimeZone } from '../src/utils/date';

describe('application date helpers', () => {
  it('uses the configured timezone when determining the application date', () => {
    const date = new Date('2026-10-20T20:00:00.000Z');

    expect(getDateInTimeZone(date)).toBe('2026-10-21');
    expect(getWeekdayInTimeZone(date)).toBe('WEDNESDAY');
  });
});
