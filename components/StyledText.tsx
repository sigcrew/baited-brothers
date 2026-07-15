import { Text, TextProps } from './Themed';

export const MonoText = (props: TextProps) => (
  <Text {...props} style={[props.style, { fontFamily: 'SpaceMono' }]} />
);
