import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { ProductivityTag } from '@timelense/shared'
import { colors, typography, spacing, radius } from '../theme'

const TAGS: { value: ProductivityTag; label: string; color: string }[] = [
  { value: 'productive', label: 'Productive', color: colors.productive },
  { value: 'neutral', label: 'Neutral', color: colors.neutral },
  { value: 'non-productive', label: 'Non-Productive', color: colors.nonProductive },
]

interface Props {
  value: ProductivityTag
  onChange: (tag: ProductivityTag) => void
}

export function TagSelector({ value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {TAGS.map((tag) => {
        const active = value === tag.value
        return (
          <TouchableOpacity
            key={tag.value}
            onPress={() => onChange(tag.value)}
            style={[styles.chip, { borderColor: tag.color, backgroundColor: active ? tag.color : 'transparent' }]}
          >
            <Text style={[styles.label, { color: active ? colors.white : tag.color }]}>{tag.label}</Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  label: { fontSize: typography.size.xs, fontWeight: typography.weight.semibold },
})
