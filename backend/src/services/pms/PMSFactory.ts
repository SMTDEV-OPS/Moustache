import { PropertyModel } from "../../models/property";
import { PMSProvider } from "../../models/common";
import { IPMSService } from "./IPMSService";
import { EzeePMSService } from "./adapters/EzeePMSService";

export class PMSFactory {
    /**
     * Get the appropriate PMS service instance for a given property.
     * @param propertyId The ID of the property
     * @returns IPMSService instance or null if no PMS is configured
     */
    static async getPMS(propertyId: string): Promise<IPMSService | null> {
        const property = await PropertyModel.findById(propertyId).lean();

        if (!property) {
            throw new Error("Property not found");
        }

        if (property.pmsProvider === PMSProvider.NONE || !property.pmsProvider) {
            return null;
        }

        if (property.pmsProvider === PMSProvider.EZEE) {
            if (!property.pmsConfig?.hotelCode || !property.pmsConfig?.authCode) {
                throw new Error("eZee PMS configuration missing (HotelCode/AuthCode)");
            }
            return new EzeePMSService({
                hotelCode: property.pmsConfig.hotelCode,
                authCode: property.pmsConfig.authCode,
            });
        }

        throw new Error(`Unsupported PMS Provider: ${property.pmsProvider}`);
    }
}
