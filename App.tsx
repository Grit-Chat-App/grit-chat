// Grit Chat, root. Six screens in one stack, dark canvas, headers drawn by the app rather than by
// the navigator so the design system owns every pixel of chrome.
//
// The three startup states are all real states, not spinners hiding a problem:
//   starting  the node is opening its store and restoring its identity from the keystore
//   failed    something load-bearing failed, stated in full, because a messenger that silently
//             mints a new identity looks healthy and orphans every contact you have
//   ready     the app

import React from 'react';
import {ActivityIndicator, StatusBar, StyleSheet, Text, View} from 'react-native';
import {NavigationContainer, Theme} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {SafeAreaProvider} from 'react-native-safe-area-context';

import {Branding} from './src/branding';
import {GritProvider, useGrit} from './src/app/GritContext';
import type {RootStackParamList} from './src/app/navigation';
import {AppConfig} from './src/config';
import {Note} from './src/components/chrome';
import {palette, space, type} from './src/design/tokens';
import {AddContactScreen} from './src/screens/AddContactScreen';
import {ChatScreen} from './src/screens/ChatScreen';
import {ConversationsScreen} from './src/screens/ConversationsScreen';
import {IdentityScreen} from './src/screens/IdentityScreen';
import {ChannelScreen} from './src/screens/ChannelScreen';
import {NewChannelScreen} from './src/screens/NewChannelScreen';
import {ScanContactScreen} from './src/screens/ScanContactScreen';
import {ChannelManageScreen} from './src/screens/ChannelManageScreen';
import {CompassScreen} from './src/screens/CompassScreen';
import {ChannelStore} from './src/store/channels';
import {ConversationStore} from './src/store/conversations';

const Stack = createNativeStackNavigator<RootStackParamList>();

const navigationTheme: Theme = {
  dark: true,
  colors: {
    primary: palette.sodium,
    background: palette.night,
    card: palette.surface,
    text: palette.alkali,
    border: palette.line,
    notification: palette.ember,
  },
  fonts: {
    regular: {fontFamily: 'Barlow-Regular', fontWeight: '400'},
    medium: {fontFamily: 'Barlow-Medium', fontWeight: '500'},
    bold: {fontFamily: 'Barlow-SemiBold', fontWeight: '600'},
    heavy: {fontFamily: 'Barlow-Bold', fontWeight: '700'},
  },
};

function Gate(): React.JSX.Element {
  const {status, error, config, store, channels} = useGrit();

  if (status === 'starting') {
    return (
      <View style={styles.center} testID="screen-starting">
        <ActivityIndicator color={palette.sodium} />
        <Text style={styles.title}>{Branding.displayName}</Text>
        <Text style={styles.dim}>restoring your identity</Text>
      </View>
    );
  }

  if (status === 'failed') {
    return (
      <View style={styles.center} testID="screen-failed">
        <Text style={styles.title}>Cannot start</Text>
        <Text style={styles.error} testID="startup-error">
          {error}
        </Text>
        <Note tone="warn">
          {config.nativeMissing
            ? 'The native modules are not linked. Rebuild the app after pod install.'
            : 'Nothing was changed. Fixing the cause above is safer than starting with a new ' +
              'identity, which would orphan every contact who saved your address.'}
        </Note>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navigationTheme} initialState={initialNavState(config, store, channels)}>
      <Stack.Navigator screenOptions={{headerShown: false, contentStyle: styles.screen}}>
        <Stack.Screen name="Conversations" component={ConversationsScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="AddContact" component={AddContactScreen} />
        <Stack.Screen name="Identity" component={IdentityScreen} />
        <Stack.Screen name="Channel" component={ChannelScreen} />
        <Stack.Screen name="NewChannel" component={NewChannelScreen} />
        <Stack.Screen name="ScanContact" component={ScanContactScreen} />
        <Stack.Screen name="ChannelManage" component={ChannelManageScreen} />
        <Stack.Screen name="Compass" component={CompassScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

/**
 * Dev-only: --grit-screen opens a given screen so a machine with no tap tool can still look
 * at chat, add-contact and identity. Production launches never pass the flag, so this returns
 * undefined and the stack starts on Conversations.
 */
function initialNavState(
  config: AppConfig,
  store: ConversationStore | undefined,
  channels: ChannelStore | undefined,
) {
  if (config.openScreen === 'identity') {
    return {index: 1, routes: [{name: 'Conversations' as const}, {name: 'Identity' as const}]};
  }
  if (config.openScreen === 'add-contact') {
    return {index: 1, routes: [{name: 'Conversations' as const}, {name: 'AddContact' as const}]};
  }
  if (config.openScreen === 'new-channel') {
    return {index: 1, routes: [{name: 'Conversations' as const}, {name: 'NewChannel' as const}]};
  }
  if (config.openScreen === 'channel') {
    const path = config.channelPath ?? channels?.listChannels()[0]?.path;
    if (path != null) {
      return {
        index: 1,
        routes: [
          {name: 'Conversations' as const},
          {name: 'Channel' as const, params: {path}},
        ],
      };
    }
  }
  if (config.openScreen === 'chat') {
    const address = config.chatPeer ?? store?.conversations()[0]?.contact.address;
    if (address != null) {
      return {
        index: 1,
        routes: [
          {name: 'Conversations' as const},
          {name: 'Chat' as const, params: {address}},
        ],
      };
    }
  }
  return undefined;
}

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <GritProvider>
        <Gate />
      </GritProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.night,
  },
  center: {
    flex: 1,
    backgroundColor: palette.night,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: space.xl,
    gap: space.m,
  },
  title: {
    ...type.display,
    color: palette.alkali,
    textTransform: 'uppercase',
  },
  dim: {
    ...type.mono,
    color: palette.dust,
  },
  error: {
    ...type.mono,
    color: palette.emberBright,
  },
});
