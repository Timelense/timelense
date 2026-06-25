// TimeLens — "Playful & colourful" primitives.
// A small kit of rainbow-flavoured building blocks shared across the Timer,
// Insights and Timeline screens. Everything here leans on react-native-svg for
// real multi-stop gradients and the Animated API for the living-time motion
// (breathe / spin / pulse / sparkle / grow) — no extra deps required.
import React, { useEffect, useRef, useState } from 'react'
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { fonts, radius, shadow, typography, useTheme } from '../theme'

// ── tiny utilities ───────────────────────────────────────────────────────────

// Unique, stable gradient ids. react-native-svg resolves `url(#id)` against the
// whole tree, so duplicate ids would cross-wire gradients between instances.
let _uid = 0
export function useUniqueId(prefix = 'g'): string {
  const ref = useRef<string>('')
  if (!ref.current) ref.current = `${prefix}_${++_uid}`
  return ref.current
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex(r: number, g: number, b: number): string {
  const x = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${x(r)}${x(g)}${x(b)}`
}
// Sample a looping palette at t∈[0,1) — used to paint the rainbow ring segments.
export function rainbowAt(t: number, palette: readonly string[]): string {
  const n = palette.length
  const f = (((t % 1) + 1) % 1) * n
  const i = Math.floor(f)
  const frac = f - i
  const a = hexToRgb(palette[i % n])
  const b = hexToRgb(palette[(i + 1) % n])
  return rgbToHex(a[0] + (b[0] - a[0]) * frac, a[1] + (b[1] - a[1]) * frac, a[2] + (b[2] - a[2]) * frac)
}

// ── pulse ring ───────────────────────────────────────────────────────────────
// Soft expanding ring that fades as it grows. Two of these (offset in time)
// sit behind the big button to make it feel alive.
function PulseRing({ color, size, duration = 2400, delay = 0 }: { color: string; size: number; duration?: number; delay?: number }) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    const t = setTimeout(() => {
      loop = Animated.loop(
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      )
      loop.start()
    }, delay)
    return () => { clearTimeout(t); loop?.stop(); anim.setValue(0) }
  }, [])
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 4,
        borderColor: color,
        opacity: anim.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.5, 0.12, 0] }),
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1.55] }) }],
      }}
    />
  )
}

// ── rainbow button ─────────────────────────────────────────────────────────
// The hero control. A circular multi-stop gradient that breathes, with two
// pulse rings behind it and a springy press. Optional second line of microcopy.
export function RainbowButton({
  size = 212,
  gradient,
  label,
  sublabel,
  shadowColor,
  onPress,
  onLongPress,
  pulse = true,
  pulseColors,
  breathe = true,
}: {
  size?: number
  gradient: readonly string[]
  label: string
  sublabel?: string
  shadowColor?: string
  onPress?: () => void
  onLongPress?: () => void
  pulse?: boolean
  pulseColors?: [string, string]
  breathe?: boolean
}) {
  const id = useUniqueId('btn')
  const press = useRef(new Animated.Value(1)).current
  const breath = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!breathe) return
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [breathe])

  const breatheScale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] })
  const pressIn = () => Animated.spring(press, { toValue: 0.93, useNativeDriver: true, speed: 40, bounciness: 4 }).start()
  const pressOut = () => Animated.spring(press, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }).start()

  const r = size / 2
  const pc: [string, string] = pulseColors ?? [gradient[0], gradient[gradient.length - 1]]

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {pulse && <PulseRing color={pc[0]} size={size} duration={2600} />}
      {pulse && <PulseRing color={pc[1]} size={size} duration={2600} delay={1300} />}
      <Pressable onPressIn={pressIn} onPressOut={pressOut} onPress={onPress} onLongPress={onLongPress}>
        <Animated.View
          style={[
            // Opaque base (hidden behind the SVG fill) so Android casts a clean
            // circular shadow rather than a grey box.
            { width: size, height: size, borderRadius: r, alignItems: 'center', justifyContent: 'center', backgroundColor: gradient[0] },
            shadow.button(shadowColor ?? gradient[0]),
            { transform: [{ scale: Animated.multiply(press, breatheScale) }] },
          ]}
        >
          <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
                {gradient.map((c, i) => (
                  <Stop key={i} offset={`${i / (gradient.length - 1)}`} stopColor={c} />
                ))}
              </LinearGradient>
            </Defs>
            <Circle cx={r} cy={r} r={r} fill={`url(#${id})`} />
          </Svg>
          <Text style={{ color: '#fff', fontFamily: fonts.bold, fontWeight: typography.weight.bold, fontSize: Math.round(size * 0.18), letterSpacing: 0.5 }}>
            {label}
          </Text>
          {!!sublabel && (
            <Text style={{ color: 'rgba(255,255,255,0.85)', fontFamily: fonts.medium, fontWeight: typography.weight.medium, fontSize: 13, marginTop: 2 }}>
              {sublabel}
            </Text>
          )}
        </Animated.View>
      </Pressable>
    </View>
  )
}

// ── rainbow ring (score) ─────────────────────────────────────────────────────
// A conic-style rainbow ring faked with many short coloured arcs, slowly
// spinning. The number in the middle stays still (the hole is a static overlay).
export function RainbowRing({
  size = 132,
  stroke = 11,
  ringColors,
  holeColor,
  centerValue,
  centerLabel,
  spin = true,
  segments = 48,
}: {
  size?: number
  stroke?: number
  ringColors: readonly string[]
  holeColor: string
  centerValue: string
  centerLabel?: string
  spin?: boolean
  segments?: number
}) {
  const { colors } = useTheme()
  const rot = useRef(new Animated.Value(0)).current
  useEffect(() => {
    if (!spin) return
    const loop = Animated.loop(
      Animated.timing(rot, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
    )
    loop.start()
    return () => loop.stop()
  }, [spin])

  const rotate = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] })
  const r = (size - stroke) / 2
  const cx = size / 2
  const cy = size / 2
  const C = 2 * Math.PI * r
  const segLen = C / segments
  const holeSize = size - 2 * stroke

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: size, height: size, transform: [{ rotate }] }}>
        <Svg width={size} height={size}>
          {Array.from({ length: segments }).map((_, i) => (
            <Circle
              key={i}
              cx={cx}
              cy={cy}
              r={r}
              stroke={rainbowAt(i / segments, ringColors)}
              strokeWidth={stroke}
              fill="none"
              strokeDasharray={`${segLen + 0.6} ${C - segLen - 0.6}`}
              strokeDashoffset={-i * segLen}
              transform={`rotate(-90 ${cx} ${cy})`}
            />
          ))}
        </Svg>
      </Animated.View>
      <View style={{ width: holeSize, height: holeSize, borderRadius: holeSize / 2, backgroundColor: holeColor, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: fonts.bold, fontWeight: typography.weight.heavy, fontSize: Math.round(size * 0.3), lineHeight: Math.round(size * 0.32), color: colors.text, fontVariant: ['tabular-nums'] }}>
          {centerValue}
        </Text>
        {!!centerLabel && (
          <Text style={{ fontFamily: fonts.medium, fontWeight: typography.weight.medium, fontSize: 11, color: colors.textMuted, marginTop: 2 }}>
            {centerLabel}
          </Text>
        )}
      </View>
    </View>
  )
}

// ── sparkle ────────────────────────────────────────────────────────────────
// A single twinkling ✦. Scatter a few (with different delays) over a hero card.
export function Sparkle({
  color,
  size = 12,
  delay = 0,
  duration = 2400,
  style,
}: {
  color: string
  size?: number
  delay?: number
  duration?: number
  style: StyleProp<ViewStyle>
}) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null
    const t = setTimeout(() => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: duration / 2, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
      )
      loop.start()
    }, delay)
    return () => { clearTimeout(t); loop?.stop() }
  }, [])
  return (
    <Animated.Text
      pointerEvents="none"
      style={[
        { position: 'absolute', fontSize: size, color },
        style,
        {
          opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
          transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
        },
      ]}
    >
      ✦
    </Animated.Text>
  )
}

// ── gradient bubble ──────────────────────────────────────────────────────────
// Rounded card with a smooth two-stop wash behind its content.
// We measure the card with onLayout and paint the gradient at explicit pixel
// dimensions with gradientUnits="userSpaceOnUse" — react-native-svg's percentage
// sizing is unreliable and was painting the fill over only part of the card.
// `direction` controls the sweep; 'horizontal' blends left → right.
export function GradientBubble({
  from,
  to,
  style,
  children,
  direction = 'horizontal',
}: {
  from: string
  to: string
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
  direction?: 'horizontal' | 'diagonal'
}) {
  const id = useUniqueId('bub')
  const [size, setSize] = useState({ w: 0, h: 0 })
  const x2 = size.w
  const y2 = direction === 'diagonal' ? size.h : 0
  return (
    // `backgroundColor: from` keeps the (possibly shadowed/elevated) container
    // opaque so Android doesn't paint the elevation shadow as a hard grey
    // rectangle, and covers the first frame before onLayout resolves.
    <View
      style={[{ borderRadius: radius.lg, overflow: 'hidden', backgroundColor: from }, style]}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout
        setSize((s) => (s.w === width && s.h === height ? s : { w: width, h: height }))
      }}
    >
      {size.w > 0 && size.h > 0 && (
        <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id={id} x1={0} y1={0} x2={x2} y2={y2} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={from} />
              <Stop offset="1" stopColor={to} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size.w} height={size.h} fill={`url(#${id})`} />
        </Svg>
      )}
      {children}
    </View>
  )
}

// ── rainbow ribbon ───────────────────────────────────────────────────────────
// A vertical multi-stop bar — the spine of the timeline. Give it an absolute
// `style` with top/bottom set and it fills that height.
export function RainbowRibbon({
  width = 5,
  stops,
  style,
}: {
  width?: number
  stops: readonly string[]
  style?: StyleProp<ViewStyle>
}) {
  const id = useUniqueId('rib')
  return (
    <View style={[{ width, overflow: 'hidden', borderRadius: width / 2 }, style]}>
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            {stops.map((c, i) => (
              <Stop key={i} offset={`${i / (stops.length - 1)}`} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  )
}

// ── brand dot ────────────────────────────────────────────────────────────────
// The little rainbow pip next to the wordmark.
export function BrandDot({ size = 16, palette }: { size?: number; palette: readonly string[] }) {
  const id = useUniqueId('dot')
  return (
    <Svg width={size} height={size}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          {palette.map((c, i) => (
            <Stop key={i} offset={`${i / (palette.length - 1)}`} stopColor={c} />
          ))}
        </LinearGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
    </Svg>
  )
}

// ── grow column ──────────────────────────────────────────────────────────────
// Wraps a fixed-height stacked bar and grows it up from the baseline once on
// mount (scaleY 0→1, anchored at the bottom via a compensating translate).
export function GrowColumn({
  height,
  delay = 0,
  style,
  children,
}: {
  height: number
  delay?: number
  style?: StyleProp<ViewStyle>
  children?: React.ReactNode
}) {
  const anim = useRef(new Animated.Value(0)).current
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 600, delay, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start()
  }, [])
  return (
    <Animated.View
      style={[
        { height },
        style,
        {
          transform: [
            { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) },
            { scaleY: anim },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  )
}
