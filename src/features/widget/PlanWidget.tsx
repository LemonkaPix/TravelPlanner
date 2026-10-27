import { FlexWidget, TextWidget } from 'react-native-android-widget';

import { colors } from '@/constants/theme';
import type { PlanWidgetData } from './widgetData';

export function PlanWidget({ data, height }: { data: PlanWidgetData; height: number }) {
  'use no memo';
  const compact = height < 240;
  return (
    <FlexWidget style={{
      width: 'match_parent', height: 'match_parent', padding: 16,
      backgroundColor: colors.surfaceContainerLow, borderRadius: 22,
      flexDirection: 'column', justifyContent: 'space-between',
    }}>
      <FlexWidget clickAction="OPEN_URI" clickActionData={{ uri: 'travelplanner:///' }} style={{ width: 'match_parent', flexDirection: 'column', flex: 1 }}
        accessibilityLabel={`${data.title}. ${data.departure ? `Wyjście ${data.departure}, ${data.departureDate}.` : data.message} ${data.deadline}. ${data.boarding}. ${data.stop}. Otwórz planer.`}>
        <TextWidget text="NAJBLIŻSZY PLAN" style={{ fontSize: 10, color: colors.primary, fontWeight: '600' }} />
        <TextWidget text={data.title} maxLines={1} truncate="END" style={{ fontSize: 18, fontWeight: '700', color: colors.onSurface, marginTop: 4 }} />
        {data.departure ? (
          <FlexWidget style={{ flexDirection: 'column' }}>
            <TextWidget text={`WYJŚCIE · ${data.departureDate}`} style={{ fontSize: 11, color: colors.onSurfaceVariant, marginTop: 6 }} />
            <TextWidget text={data.departure} style={{ fontSize: compact ? 36 : 44, fontFamily: 'monospace', fontWeight: '700', color: colors.primary }} />
          </FlexWidget>
        ) : (
          <TextWidget text={data.message} maxLines={3} truncate="END" style={{ fontSize: 13, color: colors.onSurfaceVariant, marginTop: 8 }} />
        )}
        {data.deadline ? <TextWidget text={data.deadline} maxLines={1} truncate="END" style={{ fontSize: 12, color: colors.onSurface }} /> : null}
        {data.boarding ? <TextWidget text={data.boarding} maxLines={1} truncate="END" style={{ fontSize: 12, color: colors.tertiary, marginTop: 4 }} /> : null}
        {!compact && data.stop ? <TextWidget text={data.stop} maxLines={1} truncate="END" style={{ fontSize: 12, color: colors.onSurfaceVariant, marginTop: 2 }} /> : null}
      </FlexWidget>
      <FlexWidget style={{ flexDirection: 'row', width: 'match_parent', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
        <TextWidget text={data.updated} style={{ fontSize: 10, color: colors.onSurfaceVariant }} />
        <TextWidget text="Odśwież" clickAction="REFRESH" accessibilityLabel="Odśwież najbliższy plan" style={{ fontSize: 12, color: colors.primary, paddingHorizontal: 10, paddingVertical: 10 }} />
      </FlexWidget>
    </FlexWidget>
  );
}
