import { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg'

// One softly-glowing gradient blob that drifts and breathes.
function Blob({
  color,
  size,
  style,
  duration,
  drift,
}: {
  color: string
  size: number
  style: object
  duration: number
  drift: number
}) {
  const anim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [])

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size },
        style,
        {
          transform: [
            { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, drift] }) },
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -drift / 2] }) },
            { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) },
          ],
          opacity: anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 0.8, 0.55] }),
        },
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="g" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={color} stopOpacity={0.5} />
            <Stop offset="60%" stopColor={color} stopOpacity={0.18} />
            <Stop offset="100%" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#g)" />
      </Svg>
    </Animated.View>
  )
}

// WebGL-style aurora backdrop: layered drifting gradient glows.
// Place as the first child of a screen container (absolute fill).
export function AuroraBackground({ accent = '#7C6BF5' }: { accent?: string }) {
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Blob color={accent} size={420} style={{ top: -120, left: -100 }} duration={6000} drift={50} />
      <Blob color="#FF9EC4" size={360} style={{ bottom: -80, right: -120 }} duration={7500} drift={-40} />
      <Blob color="#2FC79B" size={260} style={{ top: '38%', right: -90 }} duration={9000} drift={30} />
    </View>
  )
}
