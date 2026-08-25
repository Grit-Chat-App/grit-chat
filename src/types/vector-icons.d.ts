// react-native-vector-icons ships no type declarations for its per-family entry points (importing
// 'react-native-vector-icons/FontAwesome' resolves to a plain .js file), and the community @types
// package is deprecated and does not cover this version. Rather than let those imports fall back to
// `any` under implicit-any, declare the surface this app actually uses.
//
// Font Awesome is the icon set for this app, per the house rule. Emoji are never used as interface
// icons anywhere in this codebase.

declare module 'react-native-vector-icons/FontAwesome' {
  import * as React from 'react';
  import {TextProps, TextStyle} from 'react-native';

  export interface IconProps extends TextProps {
    /** Font Awesome 4.7 glyph name, which is the set this package's FontAwesome font carries. */
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | TextStyle[] | undefined;
  }

  const Icon: React.ComponentType<IconProps>;
  export default Icon;
}
