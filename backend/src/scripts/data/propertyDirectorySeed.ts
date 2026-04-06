import type {
  DirectoryTierLabel,
  IPropertyDirectoryContent,
} from "../../models/knowledgeBase";
import type { IProperty } from "../../models/property";

/** Region folder label (state / area) for sidebar grouping. */
export const DIRECTORY_REGION_BY_CODE: Record<string, string> = {
  BHIMTAL: "Uttarakhand",
  RANTHAMBORE: "Rajasthan",
  "UDAIPUR-LUX": "Rajasthan",
  "UDAIPUR-VER": "Rajasthan",
  "VARANASI-LUX": "Uttar Pradesh",
  JAWAI: "Rajasthan",
  KOKSAR: "Himachal Pradesh",
  "GOA-LUX": "Goa",
  "MANALI-SEL": "Himachal Pradesh",
  "MCLEOD-SEL": "Himachal Pradesh",
  MUSSOORIE: "Uttarakhand",
  "NAINITAL-SEL": "Uttarakhand",
  MUKTESHWAR: "Uttarakhand",
  NAUKUCHIATAL: "Uttarakhand",
  "UDAIPUR-SEL": "Rajasthan",
  "RISHI-RIVER": "Uttarakhand",
  "RISHI-SEL": "Uttarakhand",
  "SRI-HBOAT": "Jammu and Kashmir",
  DELHI: "Delhi",
  JAIPUR: "Rajasthan",
  JAISALMER: "Rajasthan",
  JODHPUR: "Rajasthan",
  MANALI: "Himachal Pradesh",
  "RISHI-HOST": "Uttarakhand",
  VARANASI: "Uttar Pradesh",
  SRINAGAR: "Jammu and Kashmir",
  PAHALGAM: "Jammu and Kashmir",
  PUSHKAR: "Rajasthan",
  KHAJURAHO: "Madhya Pradesh",
  BIR: "Himachal Pradesh",
  SHOJA: "Himachal Pradesh",
  GANGTOK: "Sikkim",
  "NAINITAL-HOST": "Uttarakhand",
  "UDAIPUR-HOST": "Rajasthan",
  COIMBATORE: "Tamil Nadu",
  DAMAN: "Dadra and Nagar Haveli and Daman and Diu",
};

export const SWIMMING_POOL_PROPERTY_CODES = new Set<string>([
  "GOA-LUX",
  "RISHI-HOST",
  "RANTHAMBORE",
  "MUSSOORIE",
  "UDAIPUR-VER",
]);

export const JACUZZI_PROPERTY_CODES = new Set<string>([
  "MCLEOD-SEL",
  "MANALI-SEL",
  "BHIMTAL",
  "JAWAI",
]);

function tierFromProperty(p: Pick<IProperty, "tier">): DirectoryTierLabel {
  switch (p.tier) {
    case "LUXURIA":
      return "Luxuria";
    case "SELECT":
      return "Select";
    case "HOSTEL":
      return "Hostel";
    default:
      return "Hostel";
  }
}

export function buildPropertyDirectoryContent(
  property: Pick<
    IProperty,
    "name" | "code" | "contactEmail" | "contactPhone" | "mapLocation" | "location" | "tier"
  >
): IPropertyDirectoryContent {
  const code = property.code;
  const region =
    DIRECTORY_REGION_BY_CODE[code] ||
    property.location?.state ||
    property.location?.country ||
    "India";

  const city =
    property.location?.city?.trim() ||
    region.split(" ")[0] ||
    "";

  const hotelAmenities = [
    "Wi‑Fi",
    "Parking",
    "Housekeeping",
    "24×7 front desk",
  ];
  if (SWIMMING_POOL_PROPERTY_CODES.has(code)) {
    hotelAmenities.push("Swimming pool");
  }

  const roomRows: NonNullable<IPropertyDirectoryContent["rooms"]> = [
    {
      category: "Deluxe Double Room",
      count: 4,
      isAC: true,
      isEnsuite: true,
    },
    {
      category: "Deluxe 6 Bed Mixed Dorm",
      count: 2,
      isAC: true,
      isEnsuite: false,
    },
  ];

  if (JACUZZI_PROPERTY_CODES.has(code)) {
    roomRows.unshift({
      category: "Superior Room with Jacuzzi",
      count: 2,
      isAC: true,
      isEnsuite: true,
    });
  }

  return {
    tier: tierFromProperty(property),
    region,
    city,
    address: property.name,
    contact: {
      frontDesk: property.contactPhone,
      email: property.contactEmail,
      managerName: "General Manager",
      mapLink: property.mapLocation,
    },
    checkInTime: "2:00 PM",
    checkOutTime: "11:00 AM",
    buildingHighlights: [
      "Moustache Escapes",
      "Curated stays",
      property.mapLocation ? "Map link on profile" : "",
    ].filter(Boolean),
    rooms: roomRows,
    amenities: {
      room: ["Tea & coffee", "Lockers", "Reading light", "Power sockets"],
      hotel: hotelAmenities,
      safety: ["CCTV", "Fire extinguishers", "First aid"],
      frontOffice: ["Luggage storage", "Travel desk", "Check-in assistance"],
    },
    cityInfo: {
      restaurants: [
        { name: "Local cafe", distanceOrNotes: "5–10 min walk" },
      ],
      shopping: [{ name: "Main market", distanceOrNotes: "Nearby" }],
      nightlife: [{ name: "Rooftop lounge", distanceOrNotes: "On request" }],
      attractions: [{ name: "Scenic viewpoint", distanceOrNotes: "Short drive" }],
      importantPlaces: [
        {
          name: "Nearest railway / bus",
          distanceOrNotes: "Ask front desk for latest timings",
        },
      ],
      streetFood: [{ name: "Evening stalls", distanceOrNotes: "Walking distance" }],
    },
    importSource: "manual",
  };
}
