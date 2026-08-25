// THE SIGNATURE ELEMENT. Every Hop message physically travels person to person, and the protocol
// says exactly how far: outbound carries relayed and forwardHops, inbound carries hops. No other
// messenger can show you the route a message took to reach you.
//
// THE SHAPE, and why it changed. This used to draw one dot per peer with a vertical bar before the
// terminal mark, so the trace was as wide as the journey was long and the count had to be counted.
// It now reads as three things, always in the same places:
//
//   (o) --> (3) --> check
//    me      hops    state
//
// A circle for me, the sender. An arrow to a circle carrying the hop count as a numeral. An arrow
// to a terminal glyph that says how it ended. Constant width whatever the count, and the number is
// read rather than counted.
//
// The plain-language caption stays beside it. The trace is more iconic than what it replaced, so
// the words carry more weight now, not less, and the redundancy is the point.
//
// ENCODING, unchanged from src/design/status.ts: shape first, then position, then words, then
// colour. The terminal glyph differs in silhouette per state (chevron, check, times) so the states
// survive dust, sunlight and colourblindness before any colour is parsed. Sage means confirmed
// delivery and nothing else, sodium means in flight, ember means failed.

import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';

import {palette, space, type} from '../design/tokens';
import {
  OutboundStatus,
  TraceView,
  COUNT_MAX_CHARS,
  countLabel,
  inboundTrace,
  outboundTrace,
  terminalGlyph,
} from '../design/status';

const TONE_COLOR = {
  quiet: palette.alkaliFaint,
  moving: palette.sodium,
  confirmed: palette.sage,
  failed: palette.emberBright,
} as const;

// The count circle is sized from COUNT_MAX_CHARS, not from a guess, so it can always hold what
// countLabel can return. That matters because the clamp is "99+" rather than "99": three characters,
// not two. An earlier version sized this for two digits while the function could produce three, so a
// hop count over 99 would have overflowed the circle it was supposedly clamped to fit.
//
// IBM Plex Mono advances 0.6em, so at 13px each character is 7.8px wide. Three of them is 23.4px of
// ink, and a circle's widest chord is its diameter, so 28 leaves about 2px of breathing room each
// side. Constant whatever the count, which is the point of the redesign.
const COUNT_CHAR_WIDTH = 7.8;
const COUNT_DIAMETER = Math.ceil(COUNT_MAX_CHARS * COUNT_CHAR_WIDTH) + 4;
const ME_DIAMETER = 10;
const GLYPH_SIZE = 15;
const ARROW_SIZE = 11;

export type TraceProps = {testID?: string; silent?: boolean} & (
  | ({direction: 'out'} & OutboundStatus)
  | {direction: 'in'; hops: number}
);
function Arrow({color}: {color: string}): React.JSX.Element {
  return (
    <Icon
      name="long-arrow-right"
      size={ARROW_SIZE}
      color={color}
      style={styles.arrow}
      // Decorative: the meaning is in the circles, the glyph and the caption.
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}

function Trace({view, color}: {view: TraceView; color: string}): React.JSX.Element {
  // countLabel owns the two rules that are easy to get wrong: hollow and numeral-free when no peer
  // holds a copy, and clamped rather than overflowing past 99. Both are unit tested.
  const shown = countLabel(view);
  const empty = shown == null;

  return (
    <View style={styles.row}>
      <View style={[styles.me, {backgroundColor: color}]} />
      <Arrow color={color} />
      <View
        style={[
          styles.count,
          empty ? {borderColor: color, borderWidth: 1.5} : {backgroundColor: color},
        ]}>
        {empty ? null : (
          <Text style={styles.countText} allowFontScaling={false} numberOfLines={1}>
            {shown}
          </Text>
        )}
      </View>
      <Arrow color={color} />
      <Icon name={terminalGlyph(view.cap)} size={GLYPH_SIZE} color={color} />
    </View>
  );
}

export function HopTrace(props: TraceProps): React.JSX.Element {
  const view = props.direction === 'in' ? inboundTrace(props.hops) : outboundTrace(props);
  const color = TONE_COLOR[view.tone];
  // The graphic is now iconic, so the accessibility label carries the whole meaning in words rather
  // than leaving a screen reader to infer it from three shapes.
  const spoken =
    props.direction === 'in'
      ? `Received. ${view.label}.`
      : `Sent. ${view.label}.`;
  return (
    <View
      testID={props.testID}
      style={styles.wrap}
      accessible
      accessibilityRole="text"
      accessibilityLabel={spoken}>
      <Trace view={view} color={color} />
      {props.silent === true ? null : (
        <Text
          style={[styles.label, {color}]}
          testID={props.testID != null ? `${props.testID}-label` : undefined}>
          {view.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: space.xs,
    gap: space.s,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  me: {
    width: ME_DIAMETER,
    height: ME_DIAMETER,
    borderRadius: ME_DIAMETER / 2,
  },
  arrow: {
    marginHorizontal: space.xxs,
    opacity: 0.75,
  },
  count: {
    width: COUNT_DIAMETER,
    height: COUNT_DIAMETER,
    borderRadius: COUNT_DIAMETER / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Abyss on every tone fill: 9.94:1 on sodium, 8.69:1 on sage, 7.26:1 on ember, 6.20:1 on the
  // quiet grey. One ink rule that clears AA on all four rather than a per-tone exception, and the
  // numeral stays at a legible 13px instead of being shrunk to fit.
  countText: {
    ...type.monoMedium,
    lineHeight: COUNT_DIAMETER,
    color: palette.abyss,
  },
  label: {
    ...type.monoSmall,
  },
});
