import { View, type ViewProps, type ViewStyle } from 'react-native';
import type { Edge } from 'react-native-safe-area-context';

type Props = ViewProps & { edges?: readonly Edge[] };

export function SafeAreaView({ edges = ['top', 'right', 'bottom', 'left'], style, ...props }: Props) {
  // Router 58 leaves web insets to CSS; native ViewStyle types do not include env().
  const insets = Object.fromEntries(edges.map((edge) => [
    `padding${edge[0].toUpperCase()}${edge.slice(1)}`,
    `env(safe-area-inset-${edge}, 0px)`,
  ])) as ViewStyle;

  return <View {...props} style={[style, insets]} />;
}
