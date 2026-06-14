import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import type { ProductivityTag } from '@timelense/shared'
import { useTheme, typography, spacing, radius, fonts } from '../theme'

interface Props {
  value: ProductivityTag
  onChange: (tag: ProductivityTag) => void
}

export function TagSelector({ value, onChange }: Props) {
  const { colors } = useTheme()
  const tags: { value: ProductivityTag; label: string; color: string }[] = [
    { value: 'productive', label: 'Productive', color: colors.productive },
    { value: 'neutral', label: 'Neutral', color: colors.neutral },
    { value: 'non-productive', label: 'Non-Productive', color: colors.nonProductive },
  ]
  return (
    <View style={styles.row}>
      {tags.map((tag) => {
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
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
  },
  label: { fontSize: typography.size.xs, fontFamily: fonts.semibold, fontWeight: typography.weight.bold },
})
