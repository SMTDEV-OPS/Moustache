/** Sample call metrics until CTI/IVR integration provides live data. */
export function getMockCallVolumeMetrics() {
  return {
    received: 1247,
    answered: 1189,
    missed: 58,
    isSampleData: true as const,
  };
}

export function getMockDailyCallSummary() {
  return {
    callsReceived: 342,
    callsAnswered: 318,
    callsMissed: 24,
    isSampleData: true as const,
  };
}

export const CALL_VOLUME_CHART_COLORS = {
  received: "hsl(var(--primary))",
  answered: "#10b981",
  missed: "#ef4444",
};
