import { useRouter } from 'expo-router';

import { PlanDayEditor } from '@/features/planner/PlanDayEditor';
import { useStoredPlan } from '@/features/planner/useStoredPlan';

export default function EditorRoute() {
  const store = useStoredPlan();
  const router = useRouter();
  return <PlanDayEditor store={store} onClose={() => router.navigate('/')} />;
}
