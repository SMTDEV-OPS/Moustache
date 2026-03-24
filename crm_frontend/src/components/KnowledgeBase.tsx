import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2,
  FileText,
  Download,
  MapPin,
  Bed,
  Utensils,
  Wifi,
  Car,
  Waves,
  Coffee,
  Users,
  Calendar,
  IndianRupee,
  Phone,
  Mail,
  Globe
} from "lucide-react";

const KnowledgeBase = () => {
  const [activeTab, setActiveTab] = useState("properties");

  const properties = [
    {
      id: 1,
      name: "The Postcard Goa",
      location: "Betalbatim, Goa",
      type: "Beach Resort",
      rooms: 84,
      rating: 4.8,
      description: "A stunning beachfront resort offering luxurious accommodations with panoramic views of the Arabian Sea.",
      amenities: ["Private Beach", "Spa", "Pool", "Restaurant", "Bar", "WiFi", "Parking"],
      contact: {
        phone: "+91 832 287 1234",
        email: "goa@thepostcardhotel.com",
        website: "www.thepostcardhotel.com"
      },
      rates: {
        deluxe: "₹12,000 - ₹18,000",
        suite: "₹25,000 - ₹35,000",
        villa: "₹45,000 - ₹65,000"
      }
    },
    {
      id: 2,
      name: "The Postcard Cuelim",
      location: "Cuelim, Goa",
      type: "Heritage Property",
      rooms: 20,
      rating: 4.9,
      description: "An intimate heritage property set amidst lush tropical gardens, offering a unique blend of Portuguese charm and modern luxury.",
      amenities: ["Heritage Architecture", "Garden", "Pool", "Restaurant", "Library", "WiFi"],
      contact: {
        phone: "+91 832 287 5678",
        email: "cuelim@thepostcardhotel.com",
        website: "www.thepostcardhotel.com"
      },
      rates: {
        heritage: "₹15,000 - ₹22,000",
        suite: "₹28,000 - ₹40,000"
      }
    }
  ];

  const templates = [
    {
      id: 1,
      name: "Wedding Package Proposal",
      category: "Proposals",
      description: "Comprehensive wedding package proposal template with venue details, catering options, and decoration packages",
      lastUpdated: "2024-06-15",
      downloadUrl: "#"
    },
    {
      id: 2,
      name: "Corporate Event Quotation",
      category: "Quotations",
      description: "Standard quotation template for corporate events, conferences, and business meetings",
      lastUpdated: "2024-06-10",
      downloadUrl: "#"
    },
    {
      id: 3,
      name: "Group Booking Agreement",
      category: "Agreements",
      description: "Legal agreement template for group bookings with terms and conditions",
      lastUpdated: "2024-06-12",
      downloadUrl: "#"
    },
    {
      id: 4,
      name: "Honeymoon Package Brochure",
      category: "Proposals",
      description: "Romantic honeymoon package proposal with special amenities and experiences",
      lastUpdated: "2024-06-08",
      downloadUrl: "#"
    },
    {
      id: 5,
      name: "MICE Event Proposal",
      category: "Proposals",
      description: "Meetings, Incentives, Conferences & Exhibitions event proposal template",
      lastUpdated: "2024-06-14",
      downloadUrl: "#"
    },
    {
      id: 6,
      name: "Cancellation Policy Agreement",
      category: "Agreements",
      description: "Standard cancellation and refund policy agreement for all bookings",
      lastUpdated: "2024-06-11",
      downloadUrl: "#"
    }
  ];

  const factSheets = [
    {
      property: "The Postcard Goa",
      details: {
        "Total Rooms": "84",
        "Check-in": "3:00 PM",
        "Check-out": "11:00 AM",
        "Beach Access": "Private Beach - 50 meters",
        "Airport Distance": "45 km (Goa International Airport)",
        "Railway Station": "15 km (Margao Station)",
        "Dining Options": "3 Restaurants, 2 Bars",
        "Meeting Rooms": "2 Conference Rooms (50-100 pax)",
        "Spa": "Full-service Spa with 6 treatment rooms",
        "Pool": "Infinity Pool overlooking the sea"
      }
    },
    {
      property: "The Postcard Cuelim",
      details: {
        "Total Rooms": "20",
        "Check-in": "2:00 PM",
        "Check-out": "12:00 PM",
        "Heritage Value": "Portuguese Colonial Architecture - 1850",
        "Airport Distance": "35 km (Goa International Airport)",
        "Railway Station": "12 km (Margao Station)",
        "Dining": "1 Heritage Restaurant",
        "Gardens": "5 acres of tropical gardens",
        "Library": "Heritage library with rare books",
        "Pool": "Garden pool with heritage pavilion"
      }
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-3">
        <Building2 className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Knowledge Base</h1>
          <p className="text-gray-600">Comprehensive information about Postcard Hotels properties, templates, and resources</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 bg-white shadow-sm">
          <TabsTrigger value="properties" className="flex items-center space-x-2">
            <Building2 className="h-4 w-4" />
            <span>Properties</span>
          </TabsTrigger>
          <TabsTrigger value="factsheets" className="flex items-center space-x-2">
            <FileText className="h-4 w-4" />
            <span>Fact Sheets</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
          <TabsTrigger value="resources" className="flex items-center space-x-2">
            <Globe className="h-4 w-4" />
            <span>Resources</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {properties.map((property) => (
              <Card key={property.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl text-blue-600">{property.name}</CardTitle>
                      <div className="flex items-center text-gray-600 mt-1">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="text-sm">{property.location}</span>
                      </div>
                    </div>
                    <Badge variant="secondary">{property.type}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-gray-700 text-sm">{property.description}</p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <Bed className="h-4 w-4 text-gray-500 mr-2" />
                      <span className="text-sm">{property.rooms} Rooms</span>
                    </div>
                    <div className="flex items-center">
                      <span className="text-yellow-500 mr-1">★</span>
                      <span className="text-sm">{property.rating} Rating</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Amenities</h4>
                    <div className="flex flex-wrap gap-2">
                      {property.amenities.map((amenity, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {amenity}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium text-gray-900 mb-2">Room Rates (per night)</h4>
                    <div className="space-y-1 text-sm">
                      {Object.entries(property.rates).map(([type, rate]) => (
                        <div key={type} className="flex justify-between">
                          <span className="capitalize text-gray-600">{type}:</span>
                          <span className="font-medium">{rate}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t pt-3">
                    <h4 className="font-medium text-gray-900 mb-2">Contact Information</h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center">
                        <Phone className="h-3 w-3 mr-2 text-gray-500" />
                        <span>{property.contact.phone}</span>
                      </div>
                      <div className="flex items-center">
                        <Mail className="h-3 w-3 mr-2 text-gray-500" />
                        <span>{property.contact.email}</span>
                      </div>
                      <div className="flex items-center">
                        <Globe className="h-3 w-3 mr-2 text-gray-500" />
                        <span>{property.contact.website}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="factsheets" className="space-y-6">
          <div className="grid gap-6">
            {factSheets.map((sheet, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="text-xl text-blue-600">{sheet.property} - Fact Sheet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(sheet.details).map(([key, value]) => (
                      <div key={key} className="border-l-4 border-blue-200 pl-4">
                        <div className="text-sm text-gray-600 font-medium">{key}</div>
                        <div className="text-gray-900">{value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-6 pt-4 border-t">
                    <Button variant="outline" className="w-full">
                      <Download className="h-4 w-4 mr-2" />
                      Download Complete Fact Sheet
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                        <Badge variant={
                          template.category === 'Proposals' ? 'default' :
                            template.category === 'Quotations' ? 'secondary' : 'outline'
                        }>
                          {template.category}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-3">{template.description}</p>
                      <div className="flex items-center text-xs text-gray-500">
                        <Calendar className="h-3 w-3 mr-1" />
                        Last updated: {template.lastUpdated}
                      </div>
                    </div>
                    <Button size="sm" className="ml-4">
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="resources" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-blue-600" />
                  Brand Guidelines
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  Official brand guidelines, logos, and marketing materials for consistent brand representation.
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Brand Kit
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2 text-blue-600" />
                  Policy Documents
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  Standard operating procedures, policies, and compliance documents.
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  View Policies
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <IndianRupee className="h-5 w-5 mr-2 text-blue-600" />
                  Rate Cards
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  Current rate cards for all properties including seasonal pricing and package deals.
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Download Rate Cards
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="h-5 w-5 mr-2 text-blue-600" />
                  Training Materials
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-gray-600">
                  Training modules, presentations, and educational resources for staff development.
                </div>
                <Button variant="outline" className="w-full">
                  <Download className="h-4 w-4 mr-2" />
                  Access Training
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default KnowledgeBase;