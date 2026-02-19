import { EzeePMSService } from "../src/services/pms/adapters/EzeePMSService";
import { BookingRequest } from "../src/services/pms/IPMSService";

async function verify() {
    console.log("Starting verification of EzeePMSService...");

    const service = new EzeePMSService({
        hotelCode: "TEST_HOTEL",
        authCode: "TEST_AUTH"
    });

    const bookingReq: BookingRequest = {
        checkInDate: "2023-10-20",
        checkOutDate: "2023-10-25",
        guest: {
            firstName: "John",
            lastName: "Doe",
            email: "john.doe@example.com",
            phone: "1234567890",
            city: "New York",
            country: "USA"
        },
        rooms: [
            {
                roomTypeId: "RT_001",
                ratePlanId: "RP_001",
                occupancy: { adults: 2, children: 0 },
                price: 500
            }
        ],
        totalAmount: 500,
        comments: "Test Booking from Script",
        leadId: "LEAD_123"
    };

    try {
        console.log("Attempting createBooking...");
        const result = await service.createBooking(bookingReq);
        console.log("Result:", result);
    } catch (error) {
        console.error("Expected error (network):", error instanceof Error ? error.message : error);
    }

    try {
        console.log("Attempting getInventory...");
        const inventory = await service.getInventory("2023-10-20", "2023-10-21");
        console.log("Inventory Result:", inventory);
    } catch (error) {
        console.error("Expected error (network):", error instanceof Error ? error.message : error);
    }
}

verify();
