import { PhoneNumberUtil, PhoneNumberFormat } from 'google-libphonenumber';

const phoneUtil = PhoneNumberUtil.getInstance();

/**
 * Default region for phone numbers without country code
 * Set to India (IN) - adjust based on your primary market
 */
const DEFAULT_REGION = 'IN';

/**
 * Normalize a phone number to E.164 format (+919876543210)
 * @param phone - Raw phone number string
 * @param region - ISO 3166-1 alpha-2 country code (default: IN)
 * @returns Normalized phone number in E.164 format, or null if invalid
 */
export function normalizePhone(phone: string | undefined | null, region: string = DEFAULT_REGION): string | null {
    if (!phone || typeof phone !== 'string') {
        return null;
    }

    // Remove all whitespace and common separators
    const cleaned = phone.trim();

    if (cleaned === '') {
        return null;
    }

    try {
        const parsedNumber = phoneUtil.parse(cleaned, region);

        // Validate the number
        if (!phoneUtil.isValidNumber(parsedNumber)) {
            return null;
        }

        // Return in E.164 format
        return phoneUtil.format(parsedNumber, PhoneNumberFormat.E164);
    } catch (error) {
        // If parsing fails, return null
        return null;
    }
}

/**
 * Check if a phone number is valid
 * @param phone - Raw phone number string
 * @param region - ISO 3166-1 alpha-2 country code (default: IN)
 * @returns true if valid, false otherwise
 */
export function isValidPhone(phone: string | undefined | null, region: string = DEFAULT_REGION): boolean {
    return normalizePhone(phone, region) !== null;
}

/**
 * Format a phone number for display (national format)
 * @param phone - Phone number (preferably in E.164 format)
 * @param region - ISO 3166-1 alpha-2 country code (default: IN)
 * @returns Formatted phone number for display, or original if invalid
 */
export function formatPhoneForDisplay(phone: string | undefined | null, region: string = DEFAULT_REGION): string {
    if (!phone) {
        return '';
    }

    try {
        const parsedNumber = phoneUtil.parse(phone, region);

        if (!phoneUtil.isValidNumber(parsedNumber)) {
            return phone; // Return original if invalid
        }

        // Return in national format (e.g., "098 7654 3210" for India)
        return phoneUtil.format(parsedNumber, PhoneNumberFormat.NATIONAL);
    } catch (error) {
        return phone; // Return original if parsing fails
    }
}

/**
 * Normalize email to lowercase and trim
 * @param email - Raw email string
 * @returns Normalized email, or null if invalid
 */
export function normalizeEmail(email: string | undefined | null): string | null {
    if (!email || typeof email !== 'string') {
        return null;
    }

    const cleaned = email.trim().toLowerCase();

    if (cleaned === '') {
        return null;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleaned)) {
        return null;
    }

    return cleaned;
}
