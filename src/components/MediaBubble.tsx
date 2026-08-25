// Media rendering inside a message bubble. Three honest states, and nothing else:
//
//   image      the thumbnail, with a loading frame while it decodes rather than a broken icon
//   audio      a voice note row: glyph, duration, and a play/stop button
//   missing    the bytes could not be saved or are gone; said in words, not a torn-image glyph
//
// Delivery state is NOT this component's job: the HopTrace under the bubble carries it, exactly
// as it does for text, because a photo that silently failed is worse than a text that did.

import React, {useEffect, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Image} from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome';
import AudioRecorderPlayer, {PlayBackType} from 'react-native-audio-recorder-player';

import {palette, radius, size, space, type} from '../design/tokens';
import type {StoredMessage} from '../store/conversations';

function ImageBubble({uri, testID}: {uri: string; testID: string}): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <MissingMedia testID={testID} />;
  }
  return (
    <View style={styles.imageFrame} testID={testID}>
      {loading ? (
        <View style={styles.imageLoading}>
          <ActivityIndicator color={palette.sodium} />
        </View>
      ) : null}
      <Image
        source={{uri}}
        style={styles.image}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setFailed(true);
        }}
      />
    </View>
  );
}

function VoiceBubble({
  uri,
  durationSecs,
  testID,
}: {
  uri: string;
  durationSecs?: number;
  testID: string;
}): React.JSX.Element {
  const [playing, setPlaying] = useState(false);
  const [player] = useState(() => new AudioRecorderPlayer());

  useEffect(() => {
    return () => {
      void player.stopPlayer().catch(() => {});
    };
    // One player per screen; stopping on unmount is a courtesy, not state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = async () => {
    try {
      if (playing) {
        await player.stopPlayer();
        setPlaying(false);
        return;
      }
      await player.startPlayer(uri);
      setPlaying(true);
      player.addPlayBackListener((e: PlayBackType) => {
        if (e.currentPosition >= e.duration) {
          setPlaying(false);
          player.removePlayBackListener();
        }
        return;
      });
    } catch {
      setPlaying(false);
    }
  };

  return (
    <View style={styles.voiceRow} testID={testID}>
      <TouchableOpacity
        onPress={() => void toggle()}
        style={styles.voiceButton}
        testID={`${testID}-play`}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Stop voice note' : 'Play voice note'}>
        <Icon
          name={playing ? 'stop' : 'play'}
          size={size.iconSmall}
          color={palette.sodiumBright}
        />
      </TouchableOpacity>
      <Text style={styles.voiceText} testID={`${testID}-duration`}>
        voice note{durationSecs != null ? `, ${durationSecs}s` : ''}
      </Text>
    </View>
  );
}

function MissingMedia({testID}: {testID: string}): React.JSX.Element {
  return (
    <View style={styles.missing} testID={testID}>
      <Icon name="exclamation-circle" size={size.iconSmall} color={palette.emberBright} />
      <Text style={styles.missingText}>media could not be saved or is gone</Text>
    </View>
  );
}

export function MediaBubble({
  message,
  testID,
}: {
  message: StoredMessage;
  testID: string;
}): React.JSX.Element | null {
  const contentType = message.contentType ?? '';
  if (contentType.startsWith('image/')) {
    if (message.mediaUri == null) {
      return <MissingMedia testID={`${testID}-missing`} />;
    }
    return <ImageBubble uri={message.mediaUri} testID={testID} />;
  }
  if (contentType.startsWith('audio/')) {
    if (message.mediaUri == null) {
      return <MissingMedia testID={`${testID}-missing`} />;
    }
    return <VoiceBubble uri={message.mediaUri} durationSecs={message.durationSecs} testID={testID} />;
  }
  return null;
}

const styles = StyleSheet.create({
  imageFrame: {
    borderRadius: radius.bubble,
    overflow: 'hidden',
    backgroundColor: palette.abyss,
    minWidth: 160,
    minHeight: 90,
  },
  imageLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  image: {
    width: 220,
    height: 160,
    resizeMode: 'cover',
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.m,
    minWidth: 140,
  },
  voiceButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.raised,
  },
  voiceText: {
    ...type.mono,
    color: palette.alkali,
  },
  missing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s,
  },
  missingText: {
    ...type.monoSmall,
    color: palette.emberBright,
  },
});
