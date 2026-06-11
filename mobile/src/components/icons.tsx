import Svg, { Path, Circle, Rect } from 'react-native-svg'

export interface IconProps {
  color: string
  size?: number
  focused?: boolean
}

// Stopwatch / timer
export function TimerIcon({ color, size = 24, focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle
        cx={12}
        cy={13.5}
        r={7.5}
        stroke={color}
        strokeWidth={2}
        fill={focused ? `${color}22` : 'none'}
      />
      <Path d="M12 9.5v4l2.8 1.8" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9.5 2.5h5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <Path d="M12 2.5V5" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

// Timeline / list with time dots
export function TimelineIcon({ color, size = 24, focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={5} cy={6} r={2} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Circle cx={5} cy={12} r={2} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Circle cx={5} cy={18} r={2} fill={focused ? color : 'none'} stroke={color} strokeWidth={2} />
      <Path d="M10.5 6h9M10.5 12h9M10.5 18h9" stroke={color} strokeWidth={2} strokeLinecap="round" />
    </Svg>
  )
}

// Insights / bar chart
export function InsightsIcon({ color, size = 24, focused }: IconProps) {
  const fill = focused ? color : 'none'
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={13} width={4} height={7} rx={1.2} stroke={color} strokeWidth={2} fill={fill} />
      <Rect x={10} y={8} width={4} height={12} rx={1.2} stroke={color} strokeWidth={2} fill={fill} />
      <Rect x={16} y={4} width={4} height={16} rx={1.2} stroke={color} strokeWidth={2} fill={fill} />
    </Svg>
  )
}

// Settings / gear
export function SettingsIcon({ color, size = 24, focused }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3.2} stroke={color} strokeWidth={2} fill={focused ? `${color}22` : 'none'} />
      <Path
        d="M12 2.8l1.2 2.4 2.6.5 1.9-1 1.6 1.6-1 1.9.5 2.6 2.4 1.2-1.2 2.4-2.4 1.2-.5 2.6 1 1.9-1.6 1.6-1.9-1-2.6.5L12 21.2l-1.2-2.4-2.6-.5-1.9 1-1.6-1.6 1-1.9-.5-2.6L2.8 12l2.4-1.2.5-2.6-1-1.9 1.6-1.6 1.9 1 2.6-.5L12 2.8z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  )
}
