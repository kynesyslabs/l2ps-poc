// The chain counts in OS (1 DEM = 10^9 OS, osDenomination fork). Amounts stay
// bigint/decimal strings end to end: a JS number loses precision above 2^53 OS
// (about 9 million DEM).
export const OS_PER_DEM = 1_000_000_000n
const DEM_DECIMALS = 9

/** Parses a DEM amount typed by the user ("1", "0.5") into OS. */
export function demToOs(input: string): bigint {
  const s = input.trim()
  const m = /^(\d+)(?:\.(\d+))?$/.exec(s)
  if (!m) throw new Error(`Invalid amount "${input}": use a plain number like 10 or 0.5`)
  const [, whole, frac = ''] = m
  if (frac.length > DEM_DECIMALS) throw new Error(`Invalid amount "${input}": at most ${DEM_DECIMALS} decimals`)
  return BigInt(whole) * OS_PER_DEM + BigInt(frac.padEnd(DEM_DECIMALS, '0'))
}

/** Formats an OS amount (bigint or decimal string) as DEM without rounding. */
export function osToDem(os: bigint | string | number): string {
  let v: bigint
  try {
    v = typeof os === 'bigint' ? os : BigInt(String(os))
  } catch {
    return String(os)
  }
  const neg = v < 0n
  if (neg) v = -v
  const whole = v / OS_PER_DEM
  const frac = (v % OS_PER_DEM).toString().padStart(DEM_DECIMALS, '0').replace(/0+$/, '')
  return `${neg ? '-' : ''}${whole.toLocaleString('en-US')}${frac ? `.${frac}` : ''}`
}
