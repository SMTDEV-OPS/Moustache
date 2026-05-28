export const ORGANISATION_TYPES = [
    { value: "CORPORATE", label: "Corporate" },
    { value: "TRAVEL_AGENT", label: "Travel Agent" },
    { value: "EVENT_ORGANISER", label: "Event Organiser" },
    { value: "PROFESSIONAL_CONFERENCE_ORGANISER", label: "Professional Conference Organiser (PCO)" },
    { value: "AIRLINE", label: "Airline" },
    { value: "GOVERNMENT_BODIES", label: "Government Bodies" },
    { value: "EMBASSIES_AND_CONSULATES", label: "Embassies and Consulates" },
    { value: "PUBLIC_SECTOR_UNIT", label: "Public Sector Unit" },
];
export const ORGANIZATION_TYPES = ORGANISATION_TYPES;

export const ACCOUNT_LEVELS = [
    { value: "MASTER", label: "Master Account / Conglomerate" },
    { value: "PARENT", label: "Parent Account" },
    { value: "BRANCH", label: "Branch Account" },
    { value: "SUBSIDIARY", label: "Subsidiary Account" },
];

export const INDUSTRY_LIST = [
    {
        category: "Consumer & Retail",
        subCategories: [
            "FMCG",
            "Retail (Organised & E-commerce)",
            "Apparel & Fashion",
            "Jewellery & Luxury Goods",
            "Consumer Durables",
            "Footwear & Accessories"
        ]
    },
    {
        category: "Technology & Digital",
        subCategories: [
            "IT Services",
            "ITeS / BPO / KPO",
            "Software & SaaS",
            "E-commerce & Marketplaces",
            "FinTech",
            "EdTech",
            "HealthTech"
        ]
    },
    {
        category: "Manufacturing & Industrial",
        subCategories: [
            "Automobiles & Auto Components",
            "Engineering & Capital Goods",
            "Electrical & Electronics",
            "Textiles & Garments",
            "Chemicals & Petrochemicals",
            "Metals & Mining",
            "Cement & Building Materials"
        ]
    },
    {
        category: "Healthcare & Life Sciences",
        subCategories: [
            "Pharmaceuticals",
            "Hospitals & Healthcare Services",
            "Diagnostics",
            "Medical Devices",
            "Biotechnology"
        ]
    },
    {
        category: "Financial Services",
        subCategories: [
            "Banking",
            "NBFCs",
            "Insurance",
            "Mutual Funds & Asset Management",
            "FinTech"
        ]
    },
    {
        category: "Hospitality, Travel & Leisure",
        subCategories: [
            "Hotels & Resorts",
            "Restaurants & QSR",
            "Travel & Tourism",
            "Airlines",
            "Event Management"
        ]
    },
    {
        category: "Real Estate & Infrastructure",
        subCategories: [
            "Real Estate & Construction",
            "Infrastructure & EPC",
            "Power & Utilities",
            "Renewable Energy",
            "Smart Cities"
        ]
    },
    {
        category: "Media & Communication",
        subCategories: [
            "Advertising & Marketing",
            "Digital Media",
            "Print & Publishing",
            "Television & Broadcasting",
            "Entertainment & OTT"
        ]
    },
    {
        category: "Logistics & Trade",
        subCategories: [
            "Logistics & Warehousing",
            "Shipping",
            "Courier & Express Services",
            "Ports & ICDs"
        ]
    },
    {
        category: "Education & Training",
        subCategories: [
            "Schools & Universities",
            "Coaching & Test Prep",
            "Corporate Training"
        ]
    },
    {
        category: "Others / Niche",
        subCategories: [
            "Defence & Aerospace",
            "Security Services",
            "Waste Management",
            "Facility Management",
            "NGOs & Social Enterprises"
        ]
    }
];

export const INDUSTRY_CATEGORIES: Record<string, string[]> = {
    "Consumer & Retail": [
        "FMCG",
        "Retail (Organised & E-commerce)",
        "Apparel & Fashion",
        "Jewellery & Luxury Goods",
        "Consumer Durables",
        "Footwear & Accessories"
    ],
    "Technology & Digital": [
        "IT Services",
        "ITeS / BPO / KPO",
        "Software & SaaS",
        "E-commerce & Marketplaces",
        "FinTech",
        "EdTech",
        "HealthTech"
    ],
    "Manufacturing & Industrial": [
        "Automobiles & Auto Components",
        "Engineering & Capital Goods",
        "Electrical & Electronics",
        "Textiles & Garments",
        "Chemicals & Petrochemicals",
        "Metals & Mining",
        "Cement & Building Materials"
    ],
    "Healthcare & Life Sciences": [
        "Pharmaceuticals",
        "Hospitals & Healthcare Services",
        "Diagnostics",
        "Medical Devices",
        "Biotechnology"
    ],
    "Financial Services": [
        "Banking",
        "NBFCs",
        "Insurance",
        "Mutual Funds & Asset Management",
        "FinTech"
    ],
    "Hospitality, Travel & Leisure": [
        "Hotels & Resorts",
        "Restaurants & QSR",
        "Travel & Tourism",
        "Airlines",
        "Event Management"
    ],
    "Real Estate & Infrastructure": [
        "Real Estate & Construction",
        "Infrastructure & EPC",
        "Power & Utilities",
        "Renewable Energy",
        "Smart Cities"
    ],
    "Media & Communication": [
        "Advertising & Marketing",
        "Digital Media",
        "Print & Publishing",
        "Television & Broadcasting",
        "Entertainment & OTT"
    ],
    "Logistics & Trade": [
        "Logistics & Warehousing",
        "Shipping",
        "Courier & Express Services",
        "Ports & ICDs"
    ],
    "Education & Training": [
        "Schools & Universities",
        "Coaching & Test Prep",
        "Corporate Training"
    ],
    "Others / Niche": [
        "Defence & Aerospace",
        "Security Services",
        "Waste Management",
        "Facility Management",
        "NGOs & Social Enterprises"
    ]
};

export const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Andaman and Nicobar Islands", "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
];

export const MAJOR_INDIAN_CITIES = [
    "Mumbai", "Delhi", "Bengaluru", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune", "Jaipur",
    "Lucknow", "Kanpur", "Nagpur", "Indore", "Thane", "Bhopal", "Visakhapatnam", "Pimpri-Chinchwad", "Patna",
    "Vadodara", "Ghaziabad", "Ludhiana", "Agra", "Nashik", "Faridabad", "Meerut", "Rajkot", "Kalyan-Dombivli",
    "Vasai-Virar", "Varanasi", "Srinagar", "Aurangabad", "Dhanbad", "Amritsar", "Navi Mumbai", "Allahabad",
    "Ranchi", "Howrah", "Jabalpur", "Gwalior", "Vijayawada", "Jodhpur", "Madurai", "Raipur", "Kota", "Guwahati",
    "Chandigarh", "Solapur", "Hubballi-Dharwad", "Bareilly", "Moradabad", "Mysuru", "Gurgaon", "Aligarh",
    "Jalandhar", "Tiruchirappalli", "Bhubaneswar", "Salem", "Mira-Bhayandar", "Warangal", "Thiruvananthapuram",
    "Bhiwandi", "Saharanpur", "Guntur", "Amravati", "Bikaner", "Noida", "Jamshedpur", "Bhilai", "Cuttack",
    "Firozabad", "Kochi", "Nellore", "Bhavnagar", "Dehradun", "Durgapur", "Asansol", "Rourkela", "Nanded",
    "Kolhapur", "Ajmer", "Gulbarga", "Jamnagar", "Ujjain", "Loni", "Siliguri", "Jhansi", "Ulhasnagar",
    "Jammu", "Sangli-Miraj & Kupwad", "Belgaum", "Mangalore", "Ambattur", "Tirunelveli", "Malegaon",
    "Gaya", "Jalgaon", "Udaipur", "Maheshtala"
].sort();

/** State -> cities mapping for filtering city dropdown when state is selected */
export const CITIES_BY_STATE: Record<string, string[]> = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Thane", "Pimpri-Chinchwad", "Navi Mumbai", "Nashik", "Aurangabad", "Solapur", "Mira-Bhayandar", "Bhiwandi", "Nanded", "Kolhapur", "Jalgaon", "Ulhasnagar", "Sangli-Miraj & Kupwad", "Malegaon", "Maheshtala", "Vasai-Virar", "Kalyan-Dombivli"],
    "Delhi": ["Delhi"],
    "Karnataka": ["Bengaluru", "Hubballi-Dharwad", "Mysuru", "Belgaum", "Mangalore", "Gulbarga"],
    "Telangana": ["Hyderabad", "Warangal"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot", "Bhavnagar", "Jamnagar"],
    "Tamil Nadu": ["Chennai", "Madurai", "Coimbatore", "Tiruchirappalli", "Salem", "Tirunelveli", "Ambattur"],
    "West Bengal": ["Kolkata", "Howrah", "Durgapur", "Asansol", "Siliguri"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Agra", "Allahabad", "Varanasi", "Ghaziabad", "Meerut", "Bareilly", "Moradabad", "Aligarh", "Firozabad", "Jhansi", "Loni"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Kota", "Udaipur", "Bikaner", "Ajmer"],
    "Madhya Pradesh": ["Indore", "Bhopal", "Gwalior", "Jabalpur", "Ujjain"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur", "Nellore"],
    "Bihar": ["Patna", "Gaya"],
    "Punjab": ["Ludhiana", "Amritsar", "Jalandhar"],
    "Haryana": ["Faridabad", "Gurgaon"],
    "Jharkhand": ["Dhanbad", "Jamshedpur", "Ranchi"],
    "Odisha": ["Bhubaneswar", "Cuttack", "Rourkela"],
    "Chhattisgarh": ["Raipur", "Bhilai"],
    "Assam": ["Guwahati"],
    "Kerala": ["Thiruvananthapuram", "Kochi"],
    "Uttarakhand": ["Dehradun"],
    "Jammu and Kashmir": ["Srinagar", "Jammu"],
    "Chandigarh": ["Chandigarh"],
    "Goa": [],
    "Himachal Pradesh": [],
    "Puducherry": [],
};

/** City -> state(s) for Location step (inverse of CITIES_BY_STATE) */
export const STATE_BY_CITY: Record<string, string[]> = (() => {
    const map: Record<string, string[]> = {};
    for (const [state, cities] of Object.entries(CITIES_BY_STATE)) {
        for (const city of cities) {
            if (!map[city]) map[city] = [];
            if (!map[city].includes(state)) map[city].push(state);
        }
    }
    map["Delhi"] = ["Delhi"];
    map["Chandigarh"] = ["Chandigarh"];
    return map;
})();

export function getStatesForCity(city: string): string[] {
    if (!city) return [...INDIAN_STATES];
    const states = STATE_BY_CITY[city];
    if (states?.length) return states;
    return [...INDIAN_STATES];
}

export const POTENTIAL_LOCATIONS = [
    { value: "CBD", label: "Commercial Business District" },
    { value: "MICRO_MARKET", label: "Micro Market" },
    { value: "INDUSTRIAL_BELT", label: "Industrial Belt" },
    { value: "NORTH_GEO", label: "North Geo" },
    { value: "SOUTH_GEO", label: "South Geo" },
    { value: "CUSTOM", label: "Any other" },
];

export const POTENTIAL_SEGMENTS = [
    { value: "LUXURY", label: "Luxury" },
    { value: "UPPER_UPSCALE", label: "Upper Upscale" },
    { value: "UPSCALE", label: "Upscale" },
    { value: "MID_SEGMENT", label: "Mid-Segment" },
    { value: "BUDGET", label: "Budget" },
    { value: "GUEST_HOUSE", label: "Guest House" },
];

export const MONTHS = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];
