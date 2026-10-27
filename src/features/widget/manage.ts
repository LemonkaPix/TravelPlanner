// Platform fallback keeps Android's native module out of iOS and web startup.
export async function refreshPlanWidgets(): Promise<void> {}
export async function pinPlanWidget(): Promise<boolean> { return false; }
