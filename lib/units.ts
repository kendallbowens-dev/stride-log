/**
 * Unit conversion helpers.
 *
 * Distances are stored canonically in meters everywhere in the app and
 * converted to miles only at computation/display boundaries. Keep every
 * meter<->mile conversion in this one place so the whole system stays
 * consistent.
 */

export const METERS_PER_MILE = 1609.344

export function metersToMiles(m: number): number {
  return m / METERS_PER_MILE
}

export function milesToMeters(mi: number): number {
  return mi * METERS_PER_MILE
}
