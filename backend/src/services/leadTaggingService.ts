import { ILead } from "../models/lead";
import { IProperty } from "../models/property";

export function generateTagsForLead(
    leadInput: Partial<ILead>,
    property?: IProperty | null
): string[] {
    const tags: string[] = [];

    const customData = leadInput.customData instanceof Map
        ? Object.fromEntries(leadInput.customData)
        : (leadInput.customData || {});

    // 1. City Name & Property Name
    if (property) {
        if (property.location && property.location.city) {
            tags.push(`City: ${property.location.city}`);
        }
        if (property.name) {
            tags.push(`Property: ${property.name}`);
        }
    }

    // 2. Customer Type
    const customerType = customData.customerType || customData.customer_type;
    if (customerType) {
        // E.g. "B2B", "B2C", "Corporate", "Influencer"
        tags.push(customerType);
    }

    // 3. Travel Dates
    const checkInDateRaw = (leadInput as any).checkInDate || (leadInput as any).hotels?.[0]?.checkInDate || (leadInput as any).itineraries?.[0]?.checkInDate;
    if (checkInDateRaw) {
        const checkIn = new Date(checkInDateRaw);
        const now = new Date();
        // Use start of day for accurate day difference
        checkIn.setHours(0, 0, 0, 0);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        // Difference in days
        const daysUntilCheckIn = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        if (daysUntilCheckIn <= 7) {
            tags.push("Travel: < 7 Days");
        } else if (daysUntilCheckIn <= 30) {
            tags.push("Travel: 7-30 Days");
        } else {
            tags.push("Travel: 30+ Days");
        }
    } else {
        tags.push("Travel: Yet to decide");
    }

    // 4. Minimum Budget
    const budgetAmount = customData.budget || (leadInput.estimatedValue ? parseFloat(leadInput.estimatedValue) : 0);
    if (budgetAmount > 0) {
        if (budgetAmount <= 20000) {
            tags.push("Budget: < 20k");
        } else if (budgetAmount <= 50000) {
            tags.push("Budget: 20k-50k");
        } else {
            tags.push("Budget: > 50k");
        }
    }

    // 5. Lead Source
    if (leadInput.source) {
        tags.push(`Source: ${leadInput.source}`);
    }

    // 6. Booking Window
    const bookingWindow = customData.bookingWindow || customData.booking_window;
    if (bookingWindow) {
        tags.push(`Window: ${bookingWindow}`);
    }

    return tags;
}
