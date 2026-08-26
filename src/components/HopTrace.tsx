import React, {useState} from 'react';
import {Modal, StyleSheet, Text, TouchableOpacity, View} from 'react-native';

import {
  compactInboundDeliveryText,
  compactOutboundDeliveryText,
  inboundTrace,
  OutboundStatus,
  outboundTrace,
} from '../design/status';
import {palette, radius, size, space, type} from '../design/tokens';

export type TraceProps = {testID?: string; silent?: boolean} & (
  | ({direction: 'out'} & OutboundStatus)
  | {direction: 'in'; hops: number}
);

function detailFor(props: TraceProps): string {
  if (props.direction === 'in') {
    return `Hop reported ${props.hops} ${props.hops === 1 ? 'hop' : 'hops'} to reach this device.`;
  }
  if (props.sendState === 'sending') {
    return 'Hop has accepted this message and is preparing delivery.';
  }
  if (props.sendState === 'failed') {
    return 'Hop did not confirm delivery before this send ended.';
  }
  if (props.sendState === 'delivered') {
    const hops = props.forwardHops ?? 0;
    return `The recipient confirmed delivery after ${hops} ${hops === 1 ? 'hop' : 'hops'}.`;
  }
  const relayed = props.relayed ?? 0;
  return relayed === 0
    ? 'Hop accepted this message, but no peer handoff has been reported yet.'
    : `Hop handed this message to ${relayed} ${relayed === 1 ? 'peer' : 'peers'}. Delivery is still unconfirmed.`;
}

/**
 * The message row carries compact text. Numeric route state is available in a secondary modal, but
 * the React Native SDK has no named path data, so the disclosure never invents intermediary names.
 */
export function HopTrace(props: TraceProps): React.JSX.Element {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const label =
    props.direction === 'out'
      ? compactOutboundDeliveryText(props)
      : compactInboundDeliveryText(props.hops);
  const trace = props.direction === 'out' ? outboundTrace(props) : inboundTrace(props.hops);
  const color =
    trace.tone === 'confirmed'
      ? palette.sage
      : trace.tone === 'failed'
        ? palette.emberBright
        : trace.tone === 'moving'
          ? palette.sodiumBright
          : palette.dust;

  if (props.silent === true) {
    return <Text style={[styles.silent, {color}]}>{label}</Text>;
  }

  return (
    <>
      <TouchableOpacity
        style={styles.compact}
        onPress={() => setDetailsOpen(true)}
        testID={props.testID}
        accessibilityRole="button"
        accessibilityLabel={`${label}. Show delivery details.`}>
        <Text style={[styles.label, {color}]} testID={props.testID != null ? `${props.testID}-label` : undefined}>
          {label}
        </Text>
        <Text style={styles.detailsLink}>Details</Text>
      </TouchableOpacity>
      <Modal visible={detailsOpen} transparent animationType="fade" onRequestClose={() => setDetailsOpen(false)}>
        <View style={styles.scrim}>
          <View style={styles.details} testID={props.testID != null ? `${props.testID}-details` : undefined}>
            <Text style={styles.detailsTitle}>Delivery details</Text>
            <Text style={styles.detailsBody}>{detailFor(props)}</Text>
            <TouchableOpacity
              style={styles.close}
              onPress={() => setDetailsOpen(false)}
              accessibilityRole="button"
              accessibilityLabel="Close delivery details">
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  compact: {
    minHeight: size.touchMin,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  label: {
    ...type.monoSmall,
  },
  detailsLink: {
    ...type.monoSmall,
    color: palette.alkaliFaint,
    textDecorationLine: 'underline',
  },
  silent: {
    ...type.monoSmall,
    maxWidth: 112,
    textAlign: 'right',
  },
  scrim: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(8, 9, 17, 0.82)',
  },
  details: {
    gap: space.l,
    padding: space.xl,
    borderRadius: radius.panel,
    backgroundColor: palette.surface,
  },
  detailsTitle: {
    ...type.title,
    color: palette.alkali,
  },
  detailsBody: {
    ...type.body,
    color: palette.dust,
  },
  close: {
    minHeight: size.touchMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.chip,
    borderWidth: 1,
    borderColor: palette.edge,
  },
  closeText: {
    ...type.action,
    color: palette.sodiumBright,
  },
});
