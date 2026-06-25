import type { Macro, ProductivityTag, Category } from '@timelense/shared'
import type { Palette } from '../../theme'

/** Theme colour for a productivity tag. */
export function tagColorOf(tag: ProductivityTag, colors: Palette): string {
  if (tag === 'productive') return colors.productive
  if (tag === 'non-productive') return colors.nonProductive
  return colors.neutral
}

/** Build a quick id → color lookup from the category list. */
export function categoryColorMap(categories: Category[]): Record<string, string | undefined> {
  const map: Record<string, string | undefined> = {}
  for (const c of categories) map[c.id] = c.color
  return map
}

/** Build a quick id → name lookup from the category list. */
export function categoryNameMap(categories: Category[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const c of categories) map[c.id] = c.name
  return map
}

/**
 * The accent colour for a macro: its category colour when set, otherwise the
 * colour of its productivity tag.
 */
export function macroColor(
  macro: Pick<Macro, 'categoryId' | 'tag'>,
  catColor: Record<string, string | undefined>,
  colors: Palette,
): string {
  if (macro.categoryId && catColor[macro.categoryId]) return catColor[macro.categoryId] as string
  return tagColorOf(macro.tag, colors)
}
