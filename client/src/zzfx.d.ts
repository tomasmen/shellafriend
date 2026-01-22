declare module "zzfx" {
  /** Generate a sound; returns [AudioBuffer, durationInSeconds] */
  export function zzfx(
    ...args: (number | undefined)[]
  ): [AudioBuffer, number];

  /** Master-volume multiplier (0-1). Default = 1 */
  export let zzfxV: number;

  /** Returns the shared Web-Audio context (creates it if necessary) */
  export function zzfxX(): AudioContext;
}
