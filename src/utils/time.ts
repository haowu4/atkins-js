export function getTimeDuration(duration: string): number {
    const match = duration.match(/^(\d+)([mhdwy])$/);
    if (!match) {
        throw new Error('Invalid duration format. Expected format: <number><unit> (e.g., 1h, 2d, 3w)');
    }

    const [, amount, unit] = match;
    const numAmount = parseInt(amount, 10);

    switch (unit) {
        case 'm':
            return numAmount * 60 * 1000; // minutes to milliseconds
        case 'h':
            return numAmount * 60 * 60 * 1000; // hours to milliseconds
        case 'd':
            return numAmount * 24 * 60 * 60 * 1000; // days to milliseconds
        case 'w':
            return numAmount * 7 * 24 * 60 * 60 * 1000; // weeks to milliseconds
        case 'y':
            return numAmount * 365 * 24 * 60 * 60 * 1000; // years to milliseconds
        default:
            throw new Error('Invalid time unit. Use m, h, d, w, or y');
    }
} 