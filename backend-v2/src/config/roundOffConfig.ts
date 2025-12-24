/**
 * Round-off configuration for invoice payments
 * 
 * When customers pay in whole numbers (integers), any remaining balance
 * within the threshold will be automatically adjusted as round-off.
 */

export const ROUND_OFF_THRESHOLD = 1.00; // ₹1.00

/**
 * Round a number to 2 decimal places
 */
export function roundToTwoDecimals(value: number): number {
    return Math.round(value * 100) / 100;
}

/**
 * Calculate round-off for a payment
 * 
 * @param paymentAmount - The amount customer is paying
 * @param remainingBalance - The actual remaining balance on the invoice
 * @returns Object with adjusted amount, round-off value, and whether to apply round-off
 */
export function calculateRoundOff(
    paymentAmount: number,
    remainingBalance: number
): { adjustedAmount: number; roundOff: number; shouldApplyRoundOff: boolean } {
    const roundedPayment = roundToTwoDecimals(paymentAmount);
    const roundedBalance = roundToTwoDecimals(remainingBalance);

    // Check if payment is integer (whole number)
    const isIntegerPayment = roundedPayment === Math.floor(roundedPayment);

    if (!isIntegerPayment) {
        return {
            adjustedAmount: roundedPayment,
            roundOff: 0,
            shouldApplyRoundOff: false
        };
    }

    // Calculate difference (how much extra customer is paying)
    const difference = roundToTwoDecimals(roundedPayment - roundedBalance);

    // Apply round-off if:
    // 1. Difference is positive (paying more than balance)
    // 2. Difference is within threshold
    if (difference >= 0 && difference <= ROUND_OFF_THRESHOLD) {
        return {
            adjustedAmount: roundedBalance, // Store actual amount needed
            roundOff: difference,
            shouldApplyRoundOff: true
        };
    }

    // If difference is negative (underpayment) or exceeds threshold
    return {
        adjustedAmount: roundedPayment,
        roundOff: 0,
        shouldApplyRoundOff: false
    };
}
