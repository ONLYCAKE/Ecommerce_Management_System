// Matching backend-v2 config/roundOffConfig.ts
export function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}
