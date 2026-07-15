import { View } from "react-native";
import { FIELD_COLORS } from "@/src/theme/fieldJournal";

export const ArchiveRule = ({
  ticks = false,
  color = FIELD_COLORS.rule,
}: {
  ticks?: boolean;
  color?: string;
}) => (
  <View>
    <View style={{ height: 1, backgroundColor: color }} />
    {ticks ? (
      <View className="flex-row justify-between px-4">
        {Array.from({ length: 9 }).map((_, index) => (
          <View
            key={index}
            style={{ width: 1, height: index % 2 === 0 ? 8 : 5, backgroundColor: color }}
          />
        ))}
      </View>
    ) : null}
  </View>
);
