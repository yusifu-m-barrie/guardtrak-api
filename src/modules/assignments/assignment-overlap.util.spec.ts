import { rangesOverlap } from './assignment-overlap.util';

describe('assignment-overlap.util', () => {
  describe('rangesOverlap', () => {
    it('detects overlapping ranges on the same day', () => {
      const day = new Date('2026-07-18T00:00:00.000Z');
      const existingStart = new Date(day.getTime() + 8 * 60 * 60 * 1000);
      const existingEnd = new Date(day.getTime() + 16 * 60 * 60 * 1000);
      const proposedStart = new Date(day.getTime() + 14 * 60 * 60 * 1000);
      const proposedEnd = new Date(day.getTime() + 18 * 60 * 60 * 1000);

      expect(
        rangesOverlap(existingStart, existingEnd, proposedStart, proposedEnd),
      ).toBe(true);
    });

    it('returns false for adjacent non-overlapping ranges', () => {
      const day = new Date('2026-07-18T00:00:00.000Z');
      const firstStart = new Date(day.getTime() + 8 * 60 * 60 * 1000);
      const firstEnd = new Date(day.getTime() + 12 * 60 * 60 * 1000);
      const secondStart = new Date(day.getTime() + 12 * 60 * 60 * 1000);
      const secondEnd = new Date(day.getTime() + 16 * 60 * 60 * 1000);

      expect(rangesOverlap(firstStart, firstEnd, secondStart, secondEnd)).toBe(
        false,
      );
    });

    it('detects overlap with overnight shifts (18:00–06:00 next day)', () => {
      const day = new Date('2026-07-18T00:00:00.000Z');
      const overnightStart = new Date(day.getTime() + 18 * 60 * 60 * 1000);
      const overnightEnd = new Date(day.getTime() + 30 * 60 * 60 * 1000);
      const eveningProposedStart = new Date(
        day.getTime() + 20 * 60 * 60 * 1000,
      );
      const eveningProposedEnd = new Date(day.getTime() + 22 * 60 * 60 * 1000);

      expect(
        rangesOverlap(
          overnightStart,
          overnightEnd,
          eveningProposedStart,
          eveningProposedEnd,
        ),
      ).toBe(true);
    });

    it('detects overlap when proposed shift spans into overnight window', () => {
      const day = new Date('2026-07-18T00:00:00.000Z');
      const overnightStart = new Date(day.getTime() + 18 * 60 * 60 * 1000);
      const overnightEnd = new Date(day.getTime() + 30 * 60 * 60 * 1000);
      const earlyMorningStart = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      const earlyMorningEnd = new Date(day.getTime() + 26 * 60 * 60 * 1000);

      expect(
        rangesOverlap(
          overnightStart,
          overnightEnd,
          earlyMorningStart,
          earlyMorningEnd,
        ),
      ).toBe(true);
    });

    it('returns false when ranges are completely separate across days', () => {
      const day = new Date('2026-07-18T00:00:00.000Z');
      const morningStart = new Date(day.getTime() + 6 * 60 * 60 * 1000);
      const morningEnd = new Date(day.getTime() + 10 * 60 * 60 * 1000);
      const nextDayStart = new Date(day.getTime() + 34 * 60 * 60 * 1000);
      const nextDayEnd = new Date(day.getTime() + 38 * 60 * 60 * 1000);

      expect(
        rangesOverlap(morningStart, morningEnd, nextDayStart, nextDayEnd),
      ).toBe(false);
    });
  });
});
