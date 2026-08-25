// The shared chrome every screen is built from: the dark canvas, the condensed display header, the
// relay state pill, buttons, inputs and the honesty note. Screens compose these and never restate a
// colour or a spacing value of their own.

import React from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import {SafeAreaView} from 'react-native-safe-area-context';


import {palette, radius, size, space, type} from '../design/tokens';
import {RelayStateName, relayView} from '../design/status';

/** Semantic tone to palette. Tone is the vocabulary; colour is the last of four cues. */
const TONE_COLOR = {
  quiet: palette.dust,
  moving: palette.sodiumBright,
  confirmed: palette.sodium,
  failed: palette.emberBright,
} as const;

/**
 * Uppercase at the render site rather than through `textTransform`.
 *
 * WHY. Android measures the ORIGINAL string and draws the transformed one, so an uppercased label
 * is laid out in a box sized for its lowercase self and wraps early. Measured on the first Android
 * run: "Show my address" came up as "SHOW MY / ADDRESS" across two lines in a full width button
 * with room to spare on both sides, while the two ghost buttons beside it, which carry no
 * transform, sat on one line. iOS measures the transformed string and never showed it.
 *
 * Uppercasing here means both platforms measure exactly what they draw. Accessibility labels keep
 * the original casing on purpose: a screen reader should say "Show my address", not shout it.
 */
function upper(value: string): string {
  return value.toUpperCase();
}

export function Screen({
  children,
  testID,
  style,
}: {
  children: React.ReactNode;
  testID?: string;
  style?: ViewStyle;
}): React.JSX.Element {
  return (
    // Bottom is included: the composer row sits at the screen's lower edge, and without the
    // inset the home indicator covers its lower third on a phone without a home button. Measured
    // as a composer button failing 100% visibility at y=802 on an 852pt-tall simulator.
    <SafeAreaView
      style={styles.screen}
      testID={testID}
      edges={['top', 'left', 'right', 'bottom']}>
      <View style={[styles.screenBody, style]}>{children}</View>
    </SafeAreaView>
  );
}

/** Screen header: condensed display title, optional back affordance, optional right action. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  onTitlePress,
  right,
  compact,
  testID,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Tap the title to copy or reveal. Used on chat so the address is one clean line. */
  onTitlePress?: () => void;
  right?: React.ReactNode;
  /** Chat and secondary screens. Display type is too wide once a back button shares the row. */
  compact?: boolean;
  testID?: string;
}): React.JSX.Element {
  return (
    <View style={styles.header} testID={testID}>
      {onBack != null ? (
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          testID="header-back"
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon name="chevron-left" size={size.iconSmall} color={palette.dust} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.headerText}>
        <Text
          style={compact === true ? styles.headerTitleCompact : styles.headerTitle}
          numberOfLines={1}
          onPress={onTitlePress}
          testID="header-title">
          {compact === true ? title : upper(title)}
        </Text>
        {subtitle != null ? (
          <Text style={styles.headerSubtitle} numberOfLines={1} testID="header-subtitle">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/**
 * The relay state, stated as what it is, in four distinct silhouettes (see design/status.ts).
 * "Carrying" means the socket is open and the core is driving the link; it does NOT claim the relay
 * accepted anything, because the bearer moves sealed bytes and cannot read the protocol. A delivered
 * message is the only proof of that.
 */
export function RelayPill({
  state,
  onPress,
  testID,
}: {
  state: RelayStateName;
  onPress?: () => void;
  testID?: string;
}): React.JSX.Element {
  const view = relayView(state);
  const tint = TONE_COLOR[view.tone];
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={onPress == null}
      style={[styles.pill, view.underline && {borderBottomWidth: 2, borderBottomColor: tint}]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={view.label}>
      <Icon name={view.glyph} size={size.iconSmall} color={tint} />
      <Text style={[styles.pillText, {color: tint}]}>{view.label}</Text>
    </TouchableOpacity>
  );
}

export function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
  busy,
  testID,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  testID?: string;
}): React.JSX.Element {
  const off = disabled === true || busy === true;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={off}
      style={[styles.primary, off && styles.primaryOff]}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {busy === true ? (
        <ActivityIndicator color={palette.sodiumDeep} />
      ) : (
        <>
          {icon != null ? <Icon name={icon} size={size.iconSmall} color={palette.sodiumDeep} /> : null}
          <Text style={styles.primaryText} numberOfLines={1}>
            {upper(label)}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function GhostButton({
  label,
  icon,
  onPress,
  testID,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  testID?: string;
}): React.JSX.Element {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.ghost}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}>
      {icon != null ? <Icon name={icon} size={size.iconSmall} color={palette.sodiumBright} /> : null}
      <Text style={styles.ghostText}>{label}</Text>
    </TouchableOpacity>
  );
}

export function Field(props: TextInputProps & {label?: string}): React.JSX.Element {
  const {label, style, ...rest} = props;
  return (
    <View style={styles.fieldWrap}>
      {label != null ? <Text style={styles.fieldLabel}>{upper(label)}</Text> : null}
      <TextInput
        placeholderTextColor={palette.alkaliFaint}
        style={[styles.field, style]}
        {...rest}
      />
    </View>
  );
}

/** A plain statement of what is and is not true. Never decoration, never marketing. */
export function Note({
  children,
  tone = 'quiet',
  testID,
}: {
  children: React.ReactNode;
  tone?: 'quiet' | 'warn';
  testID?: string;
}): React.JSX.Element {
  return (
    <Text
      style={[styles.note, tone === 'warn' && {color: palette.emberBright}]}
      testID={testID}>
      {children}
    </Text>
  );
}

export function SectionTitle({children}: {children: React.ReactNode}): React.JSX.Element {
  return (
    <Text style={styles.sectionTitle}>
      {typeof children === 'string' ? upper(children) : children}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.night,
  },
  screenBody: {
    flex: 1,
    width: '100%',
  },
  header: {
    minHeight: size.touchMin,
    paddingHorizontal: space.xl,
    paddingTop: space.m,
    paddingBottom: space.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
    borderBottomWidth: 1,
    borderBottomColor: palette.line,
  },
  backButton: {
    width: size.touchMin,
    height: size.touchMin,
    marginLeft: -space.l,
    marginRight: -space.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    ...type.display,
    color: palette.alkali,
  },
  headerTitleCompact: {
    ...type.title,
    color: palette.alkali,
  },
  headerSubtitle: {
    ...type.mono,
    color: palette.dust,
    marginTop: space.xxs,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.m,
    height: 34,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
    backgroundColor: palette.surface,
  },
  pillText: {
    ...type.monoSmall,
  },
  primary: {
    minHeight: size.touchMin,
    borderRadius: radius.chip,
    backgroundColor: palette.sodium,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingHorizontal: space.xl,
  },
  primaryOff: {
    // 0.6, not 0.45. At 0.45 the label on the amber fill was effectively unreadable on the New
    // channel screen: dimming the whole button dims the label with it, and the action text on a
    // sodium fill has little contrast headroom to give away. No ratio quoted here on purpose, since
    // the token values are owned elsewhere and a number in this comment would go stale. Disabled
    // controls are exempt from the WCAG minimum, but a control whose label cannot be read does not
    // tell you what it would do once enabled.
    opacity: 0.6,
  },
  primaryText: {
    ...type.action,
    color: palette.sodiumDeep,
    // No tracking on this one label, deliberately. Android's ellipsizer does not account for the
    // letter spacing it adds after the FINAL character, so with numberOfLines it clipped
    // "SHOW MY ADDRESS" to "SHOW MY ADDRE..." inside a 975px button whose label box it had itself
    // measured at 389px. Measured both ways on a Pixel 6a emulator: 0.6 clips, 0 fits.
    // A truncated action label is a worse outcome than slightly tighter caps, and one look on both
    // platforms is worth more here than 0.6dp of tracking.
    letterSpacing: 0,
  },
  ghost: {
    minHeight: size.touchMin,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s,
    paddingHorizontal: space.l,
  },
  ghostText: {
    ...type.action,
    color: palette.sodiumBright,
  },
  fieldWrap: {
    gap: space.xs,
  },
  fieldLabel: {
    ...type.secondary,
    color: palette.dust,
    letterSpacing: 0.8,
  },
  field: {
    minHeight: size.touchMin,
    backgroundColor: palette.raised,
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
    paddingHorizontal: space.l,
    ...type.mono,
    color: palette.alkali,
  },
  note: {
    ...type.secondary,
    color: palette.dust,
  },
  sectionTitle: {
    ...type.secondary,
    color: palette.alkaliFaint,
    letterSpacing: 1.1,
  },
});
