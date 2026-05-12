/**
 * scaleIngredients.js
 * Scale recipe ingredient quantities by a servings ratio.
 * Handles integers, decimals, simple fractions (1/2), and mixed numbers (1 1/2).
 */

// Fraction → decimal tolerance window
const TOLERANCE = 0.04

// Ordered from smallest to largest so mixed-number decomposition picks right
const FRACTIONS = [
  [1/8,  '1/8'],
  [1/4,  '1/4'],
  [1/3,  '1/3'],
  [3/8,  '3/8'],
  [1/2,  '1/2'],
  [5/8,  '5/8'],
  [2/3,  '2/3'],
  [3/4,  '3/4'],
  [7/8,  '7/8'],
]

/**
 * Try to express a decimal in (0, 1) as a common fraction string.
 * Returns null if no match within tolerance.
 */
function decimalToFraction(dec) {
  for (const [val, str] of FRACTIONS) {
    if (Math.abs(dec - val) < TOLERANCE) return str
  }
  return null
}

/**
 * Format a scaled number back into a human-readable string.
 * Whole numbers stay whole. Fractions use slash notation.
 * Mixed numbers like 1.5 → "1 1/2". Fallback to 2-decimal rounding.
 */
function formatNumber(num) {
  if (num <= 0) return '0'

  const whole = Math.floor(num)
  const decimal = num - whole

  // Close enough to a whole number
  if (decimal < TOLERANCE) return String(whole)

  // Close enough to the next whole number
  if (1 - decimal < TOLERANCE) return String(whole + 1)

  const frac = decimalToFraction(decimal)
  if (frac) {
    return whole > 0 ? `${whole} ${frac}` : frac
  }

  // No clean fraction — round to 2 decimal places, strip trailing zeros
  const rounded = Math.round(num * 100) / 100
  return String(rounded)
}

/**
 * Parse a leading number (integer, decimal, fraction, or mixed number)
 * from the start of an ingredient string.
 *
 * Returns { value: number, rest: string } or null if no leading number found.
 */
function parseLeadingNumber(str) {
  const s = str.trimStart()

  // Mixed number: "1 1/2 cups …" — whole, space, fraction
  // Must be digits/fraction separated by exactly one space before the fraction
  const mixedMatch = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/s)
  if (mixedMatch) {
    const whole = parseInt(mixedMatch[1], 10)
    const num   = parseInt(mixedMatch[2], 10)
    const den   = parseInt(mixedMatch[3], 10)
    if (den !== 0) {
      return { value: whole + num / den, rest: mixedMatch[4] }
    }
  }

  // Simple fraction: "1/2 tsp …"
  const fracMatch = s.match(/^(\d+)\/(\d+)(.*)$/s)
  if (fracMatch) {
    const num = parseInt(fracMatch[1], 10)
    const den = parseInt(fracMatch[2], 10)
    if (den !== 0) {
      return { value: num / den, rest: fracMatch[3] }
    }
  }

  // Decimal or integer: "2.5 cups …" or "3 large eggs"
  const numMatch = s.match(/^(\d+(?:\.\d+)?)(.*)$/s)
  if (numMatch) {
    return { value: parseFloat(numMatch[1]), rest: numMatch[2] }
  }

  return null
}

/**
 * Scale an array of ingredient strings from originalServings to targetServings.
 *
 * @param {string[]} ingredients   - e.g. ["2 cups flour", "1/2 tsp salt"]
 * @param {number}   originalServings
 * @param {number}   targetServings
 * @returns {string[]} scaled ingredient strings
 */
export function scaleIngredients(ingredients, originalServings, targetServings) {
  if (!Array.isArray(ingredients) || ingredients.length === 0) return ingredients ?? []
  if (!originalServings || originalServings === 0 || !targetServings) return ingredients

  const ratio = targetServings / originalServings
  if (ratio === 1) return ingredients

  return ingredients.map(ing => {
    if (!ing || typeof ing !== 'string') return ing

    const parsed = parseLeadingNumber(ing)
    if (!parsed) return ing

    const scaled    = parsed.value * ratio
    const formatted = formatNumber(scaled)
    return formatted + parsed.rest
  })
}
