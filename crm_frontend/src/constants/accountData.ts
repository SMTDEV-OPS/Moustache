export const ORGANIZATION_TYPES = [
    { value: "CORPORATE", label: "Corporate" },
    { value: "TRAVEL_AGENT", label: "Travel Agent" },
    { value: "EVENT_PLANNER", label: "Event Organiser" },
    { value: "PCO", label: "Professional Conference Organiser" },
    { value: "AIRLINE", label: "Airline" },
    { value: "GOVERNMENT", label: "Government Bodies" },
    { value: "EMBASSY_CONSULATE", label: "Embassies and Consulates" },
    { value: "PSU", label: "Public Sector Unit" },
    { value: "CUSTOM", label: "Other" },
];

export const ACCOUNT_LEVELS = [
    { value: "MASTER", label: "Master Account or Conglomerate" },
    { value: "PARENT", label: "Parent Account" },
    { value: "BRANCH", label: "Branch Account" },
    { value: "SUBSIDIARY", label: "Subsidiary account" },
];

export const INDUSTRY_CATEGORIES: Record<string, string[]> = {
    "Consumer & Retail": [
        "FMCG (Fast Moving Consumer Goods)",
        "Retail (Organised & E-commerce)",
        "Apparel & Fashion",
        "Jewellery & Luxury Goods",
        "Consumer Durables",
        "Footwear & Accessories"
    ],
    "Technology & Digital": [
        "IT Services",
        "IT Enabled Services (ITeS / BPO / KPO)",
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
    "Agri & Allied": [
        "Agriculture",
        "Food Processing",
        "Dairy",
        "Fisheries",
        "Poultry",
        "Agri-Tech"
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
