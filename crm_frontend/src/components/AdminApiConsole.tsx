import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

type HttpMethod = "GET" | "POST" | "PATCH";

interface LastResponse {
  label: string;
  method: HttpMethod;
  path: string;
  timestamp: string;
  data: unknown;
}

async function callApi(
  path: string,
  method: HttpMethod,
  body?: unknown
): Promise<unknown> {
  const url = `${API_BASE_URL}${path}`;
  const hasBody = body !== undefined;

  const res = await fetch(url, {
    method,
    headers: withAuthHeaders(
      hasBody
        ? {
          "Content-Type": "application/json",
        }
        : {}
    ),
    body: hasBody ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = (await res.json()) as any;
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore parse issues
    }
    throw new Error(message);
  }

  if (res.status === 204) {
    return null;
  }

  try {
    return await res.json();
  } catch {
    return null;
  }
}

export const AdminApiConsole = () => {
  const { toast } = useToast();
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<LastResponse | null>(null);

  // Leads state
  const [leadFilters, setLeadFilters] = useState({
    status: "",
    assigneeId: "",
    propertyId: "",
    fromDate: "",
    toDate: "",
    heat: "",
  });
  const [leadId, setLeadId] = useState("");
  const [leadCreateJson, setLeadCreateJson] = useState(
    JSON.stringify(
      {
        guestContact: {
          name: "Example Guest",
          phone: "+91 90000 00000",
          email: "guest@example.com",
        },
        source: "WEBSITE",
        leadType: "INDIVIDUAL",
      },
      null,
      2
    )
  );
  const [leadUpdateJson, setLeadUpdateJson] = useState(
    JSON.stringify(
      {
        status: "TENTATIVE",
        heatLevel: "WARM",
      },
      null,
      2
    )
  );
  const [activityJson, setActivityJson] = useState(
    JSON.stringify(
      {
        type: "FOLLOW_UP",
        note: "Call back the guest",
      },
      null,
      2
    )
  );
  const [communicationJson, setCommunicationJson] = useState(
    JSON.stringify(
      {
        channel: "CALL",
        direction: "OUTBOUND",
        disposition: "GENERAL_INQUIRY",
        summary: "Spoke with guest about dates",
      },
      null,
      2
    )
  );
  const [quotationJson, setQuotationJson] = useState(
    JSON.stringify(
      {
        rooms: 1,
        rate: 15000,
        taxes: 2700,
        inclusions: "Breakfast, WiFi",
        sentVia: "EMAIL",
      },
      null,
      2
    )
  );
  const [paymentLinkJson, setPaymentLinkJson] = useState(
    JSON.stringify(
      {
        gateway: "RAZORPAY",
        amount: 50000,
      },
      null,
      2
    )
  );

  // Guests
  const [guestSearch, setGuestSearch] = useState({
    phone: "",
    email: "",
    name: "",
  });
  const [guestId, setGuestId] = useState("");
  const [guestUpdateJson, setGuestUpdateJson] = useState(
    JSON.stringify(
      {
        name: "Updated Guest Name",
        isSunshineMember: true,
        sunshineTier: "GOLD",
        tags: ["VIP", "Frequent"],
      },
      null,
      2
    )
  );

  // Accounts
  const [accountFilters, setAccountFilters] = useState({
    type: "",
    city: "",
  });
  const [accountCreateJson, setAccountCreateJson] = useState(
    JSON.stringify(
      {
        name: "Sample Travel Agent",
        type: "TRAVEL_AGENT",
        city: "Mumbai",
      },
      null,
      2
    )
  );
  const [accountId, setAccountId] = useState("");
  const [accountUpdateJson, setAccountUpdateJson] = useState(
    JSON.stringify(
      {
        notes: "High value account",
      },
      null,
      2
    )
  );

  // Properties & Regions
  const [propertyCreateJson, setPropertyCreateJson] = useState(
    JSON.stringify(
      {
        name: "Postcard Demo",
        code: "PCD",
        location: {
          city: "Goa",
          state: "Goa",
          country: "India",
        },
        status: "ACTIVE",
      },
      null,
      2
    )
  );
  const [propertyId, setPropertyId] = useState("");
  const [propertyUpdateJson, setPropertyUpdateJson] = useState(
    JSON.stringify(
      {
        status: "ACTIVE",
      },
      null,
      2
    )
  );

  const [regionCreateJson, setRegionCreateJson] = useState(
    JSON.stringify(
      {
        name: "West India",
      },
      null,
      2
    )
  );
  const [regionId, setRegionId] = useState("");
  const [regionUpdateJson, setRegionUpdateJson] = useState(
    JSON.stringify(
      {
        name: "Updated Region Name",
      },
      null,
      2
    )
  );

  // Reservations
  const [reservationFilters, setReservationFilters] = useState({
    propertyId: "",
    guestId: "",
    fromDate: "",
    toDate: "",
  });
  const [reservationLeadId, setReservationLeadId] = useState("");
  const [reservationCreateJson, setReservationCreateJson] = useState(
    JSON.stringify(
      {
        checkInDate: new Date().toISOString(),
        checkOutDate: new Date(
          Date.now() + 24 * 60 * 60 * 1000
        ).toISOString(),
        roomsBooked: 1,
        ratePlan: "BAR",
        totalAmount: 12000,
      },
      null,
      2
    )
  );

  // Tasks
  const [taskFilters, setTaskFilters] = useState({
    ownerUserId: "",
    status: "",
    fromDue: "",
    toDue: "",
  });
  const [taskCreateJson, setTaskCreateJson] = useState(
    JSON.stringify(
      {
        title: "Follow up with guest",
        description: "Call guest about confirmation",
        ownerUserId: "",
        leadId: "",
        dueAt: new Date(
          Date.now() + 2 * 60 * 60 * 1000
        ).toISOString(),
      },
      null,
      2
    )
  );
  const [taskId, setTaskId] = useState("");
  const [taskUpdateJson, setTaskUpdateJson] = useState(
    JSON.stringify(
      {
        status: "COMPLETED",
      },
      null,
      2
    )
  );

  // Buddies
  const [buddyUserId, setBuddyUserId] = useState("");
  const [buddyBuddyUserId, setBuddyBuddyUserId] = useState("");
  const [buddyReportUserId, setBuddyReportUserId] = useState("");

  // Workflows
  const [workflowCreateJson, setWorkflowCreateJson] = useState(
    JSON.stringify(
      {
        name: "Website INDIVIDUAL default",
        appliesTo: {
          leadType: "INDIVIDUAL",
          source: "WEBSITE",
        },
        steps: [
          {
            offsetMinutes: 10,
            actionType: "CALL",
          },
        ],
      },
      null,
      2
    )
  );
  const [workflowId, setWorkflowId] = useState("");
  const [workflowUpdateJson, setWorkflowUpdateJson] = useState(
    JSON.stringify(
      {
        isActive: true,
      },
      null,
      2
    )
  );

  // Availability
  const [availabilityPropertyId, setAvailabilityPropertyId] = useState("");
  const [availabilityCreateJson, setAvailabilityCreateJson] = useState(
    JSON.stringify(
      {
        propertyId: "",
        date: new Date().toISOString(),
        data: {
          roomTypes: [],
        },
      },
      null,
      2
    )
  );

  // Reports
  const [reportsDate, setReportsDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const handleError = (err: unknown) => {
    const description =
      err instanceof Error ? err.message : "Unexpected error occurred";
    toast({
      title: "Request failed",
      description,
      variant: "destructive",
    });
  };

  const makeCall = async (
    key: string,
    label: string,
    method: HttpMethod,
    path: string,
    body?: unknown
  ) => {
    try {
      setLoadingKey(key);
      const data = await callApi(path, method, body);
      setLastResponse({
        label,
        method,
        path,
        timestamp: format(new Date(), "yyyy-MM-dd HH:mm:ss"),
        data,
      });
      toast({
        title: "Request successful",
        description: label,
      });
    } catch (err) {
      handleError(err);
    } finally {
      setLoadingKey((current) => (current === key ? null : current));
    }
  };

  const isLoading = (key: string) => loadingKey === key;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Admin API Console</h1>
          <p className="text-sm text-muted-foreground">
            Full access to CRM backend features using your admin
            session.
          </p>
        </div>
        <Badge variant="outline">Backend: {API_BASE_URL}</Badge>
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="flex flex-wrap gap-2">
          <TabsTrigger value="leads">Leads & Timeline</TabsTrigger>
          <TabsTrigger value="guests">Guests</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="properties">Properties & Regions</TabsTrigger>
          <TabsTrigger value="reservations">Reservations</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="buddies">Buddy System</TabsTrigger>
          <TabsTrigger value="workflows">Workflows</TabsTrigger>
          <TabsTrigger value="availability">Availability</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        {/* Leads */}
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Leads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                {/* List leads */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">List Leads</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input
                      placeholder="Status"
                      value={leadFilters.status}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          status: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Assignee ID"
                      value={leadFilters.assigneeId}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          assigneeId: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Property ID"
                      value={leadFilters.propertyId}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          propertyId: e.target.value,
                        }))
                      }
                    />
                    <Input
                      placeholder="Heat level"
                      value={leadFilters.heat}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          heat: e.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      placeholder="From date"
                      value={leadFilters.fromDate}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          fromDate: e.target.value,
                        }))
                      }
                    />
                    <Input
                      type="date"
                      placeholder="To date"
                      value={leadFilters.toDate}
                      onChange={(e) =>
                        setLeadFilters((f) => ({
                          ...f,
                          toDate: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <Button
                    size="sm"
                    disabled={isLoading("leads-list")}
                    onClick={() => {
                      const params = new URLSearchParams();
                      Object.entries(leadFilters).forEach(([key, value]) => {
                        if (value) params.append(key, value);
                      });
                      makeCall(
                        "leads-list",
                        "GET /leads",
                        "GET",
                        `/leads${params.toString() ? `?${params.toString()}` : ""
                        }`
                      );
                    }}
                  >
                    {isLoading("leads-list") ? "Loading..." : "Fetch Leads"}
                  </Button>
                </div>

                {/* Get / update single lead */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Lead Detail & Update
                  </h3>
                  <Input
                    placeholder="Lead ID"
                    value={leadId}
                    onChange={(e) => setLeadId(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!leadId || isLoading("lead-get")}
                      onClick={() =>
                        makeCall(
                          "lead-get",
                          `GET /leads/${leadId}`,
                          "GET",
                          `/leads/${leadId}`
                        )
                      }
                    >
                      {isLoading("lead-get") ? "Loading..." : "Get Lead"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!leadId || isLoading("lead-update")}
                      onClick={() => {
                        try {
                          const payload = JSON.parse(leadUpdateJson);
                          makeCall(
                            "lead-update",
                            `PATCH /leads/${leadId}`,
                            "PATCH",
                            `/leads/${leadId}`,
                            payload
                          );
                        } catch {
                          handleError(
                            new Error("Invalid JSON in lead update payload")
                          );
                        }
                      }}
                    >
                      {isLoading("lead-update") ? "Updating..." : "Update Lead"}
                    </Button>
                  </div>
                  <Textarea
                    rows={8}
                    value={leadUpdateJson}
                    onChange={(e) => setLeadUpdateJson(e.target.value)}
                  />
                </div>
              </div>

              {/* Create lead */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Create Lead</h3>
                <Textarea
                  rows={8}
                  value={leadCreateJson}
                  onChange={(e) => setLeadCreateJson(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={isLoading("lead-create")}
                  onClick={() => {
                    try {
                      const payload = JSON.parse(leadCreateJson);
                      makeCall(
                        "lead-create",
                        "POST /leads",
                        "POST",
                        "/leads",
                        payload
                      );
                    } catch {
                      handleError(
                        new Error("Invalid JSON in lead create payload")
                      );
                    }
                  }}
                >
                  {isLoading("lead-create") ? "Creating..." : "Create Lead"}
                </Button>
              </div>

              {/* Timeline: activities, communications, quotations, payment links */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Lead Activities</h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!leadId || isLoading("activities-list")}
                      onClick={() =>
                        makeCall(
                          "activities-list",
                          `GET /leads/${leadId}/activities`,
                          "GET",
                          `/leads/${leadId}/activities`
                        )
                      }
                    >
                      {isLoading("activities-list")
                        ? "Loading..."
                        : "List Activities"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!leadId || isLoading("activities-create")}
                      onClick={() => {
                        try {
                          const payload = JSON.parse(activityJson);
                          makeCall(
                            "activities-create",
                            `POST /leads/${leadId}/activities`,
                            "POST",
                            `/leads/${leadId}/activities`,
                            payload
                          );
                        } catch {
                          handleError(
                            new Error("Invalid JSON in activity payload")
                          );
                        }
                      }}
                    >
                      {isLoading("activities-create")
                        ? "Creating..."
                        : "Add Activity"}
                    </Button>
                  </div>
                  <Textarea
                    rows={6}
                    value={activityJson}
                    onChange={(e) => setActivityJson(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Communications, Quotations & Payment Links
                  </h3>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={
                          !leadId || isLoading("communications-list")
                        }
                        onClick={() =>
                          makeCall(
                            "communications-list",
                            `GET /leads/${leadId}/communications`,
                            "GET",
                            `/leads/${leadId}/communications`
                          )
                        }
                      >
                        {isLoading("communications-list")
                          ? "Loading..."
                          : "List Communications"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={
                          !leadId || isLoading("communications-create")
                        }
                        onClick={() => {
                          try {
                            const payload = JSON.parse(communicationJson);
                            makeCall(
                              "communications-create",
                              `POST /leads/${leadId}/communications`,
                              "POST",
                              `/leads/${leadId}/communications`,
                              payload
                            );
                          } catch {
                            handleError(
                              new Error(
                                "Invalid JSON in communication payload"
                              )
                            );
                          }
                        }}
                      >
                        {isLoading("communications-create")
                          ? "Creating..."
                          : "Add Communication"}
                      </Button>
                    </div>
                    <Textarea
                      rows={4}
                      value={communicationJson}
                      onChange={(e) =>
                        setCommunicationJson(e.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!leadId || isLoading("quotes-list")}
                        onClick={() =>
                          makeCall(
                            "quotes-list",
                            `GET /leads/${leadId}/quotations`,
                            "GET",
                            `/leads/${leadId}/quotations`
                          )
                        }
                      >
                        {isLoading("quotes-list")
                          ? "Loading..."
                          : "List Quotations"}
                      </Button>
                      <Button
                        size="sm"
                        disabled={!leadId || isLoading("quotes-create")}
                        onClick={() => {
                          try {
                            const payload = JSON.parse(quotationJson);
                            makeCall(
                              "quotes-create",
                              `POST /leads/${leadId}/quotations`,
                              "POST",
                              `/leads/${leadId}/quotations`,
                              payload
                            );
                          } catch {
                            handleError(
                              new Error("Invalid JSON in quotation payload")
                            );
                          }
                        }}
                      >
                        {isLoading("quotes-create")
                          ? "Creating..."
                          : "Create Quotation"}
                      </Button>
                    </div>
                    <Textarea
                      rows={4}
                      value={quotationJson}
                      onChange={(e) => setQuotationJson(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={
                          !leadId || isLoading("payment-links-create")
                        }
                        onClick={() => {
                          try {
                            const payload = JSON.parse(paymentLinkJson);
                            makeCall(
                              "payment-links-create",
                              `POST /leads/${leadId}/payment-links`,
                              "POST",
                              `/leads/${leadId}/payment-links`,
                              payload
                            );
                          } catch {
                            handleError(
                              new Error(
                                "Invalid JSON in payment link payload"
                              )
                            );
                          }
                        }}
                      >
                        {isLoading("payment-links-create")
                          ? "Creating..."
                          : "Create Payment Link"}
                      </Button>
                    </div>
                    <Textarea
                      rows={3}
                      value={paymentLinkJson}
                      onChange={(e) =>
                        setPaymentLinkJson(e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Guests */}
        <TabsContent value="guests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Guests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Search Guests</h3>
                  <Input
                    placeholder="Phone"
                    value={guestSearch.phone}
                    onChange={(e) =>
                      setGuestSearch((s) => ({
                        ...s,
                        phone: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Email"
                    value={guestSearch.email}
                    onChange={(e) =>
                      setGuestSearch((s) => ({
                        ...s,
                        email: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Name contains"
                    value={guestSearch.name}
                    onChange={(e) =>
                      setGuestSearch((s) => ({
                        ...s,
                        name: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("guests-search")}
                    onClick={() => {
                      const params = new URLSearchParams();
                      Object.entries(guestSearch).forEach(
                        ([key, value]) => {
                          if (value) params.append(key, value);
                        }
                      );
                      makeCall(
                        "guests-search",
                        "GET /guests/search",
                        "GET",
                        `/guests/search${params.toString() ? `?${params.toString()}` : ""
                        }`
                      );
                    }}
                  >
                    {isLoading("guests-search")
                      ? "Searching..."
                      : "Search Guests"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Guest Detail & Update
                  </h3>
                  <Input
                    placeholder="Guest ID"
                    value={guestId}
                    onChange={(e) => setGuestId(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!guestId || isLoading("guest-get")}
                      onClick={() =>
                        makeCall(
                          "guest-get",
                          `GET /guests/${guestId}`,
                          "GET",
                          `/guests/${guestId}`
                        )
                      }
                    >
                      {isLoading("guest-get")
                        ? "Loading..."
                        : "Get Guest"}
                    </Button>
                    <Button
                      size="sm"
                      disabled={!guestId || isLoading("guest-update")}
                      onClick={() => {
                        try {
                          const payload = JSON.parse(guestUpdateJson);
                          makeCall(
                            "guest-update",
                            `PATCH /guests/${guestId}`,
                            "PATCH",
                            `/guests/${guestId}`,
                            payload
                          );
                        } catch {
                          handleError(
                            new Error("Invalid JSON in guest update payload")
                          );
                        }
                      }}
                    >
                      {isLoading("guest-update")
                        ? "Updating..."
                        : "Update Guest"}
                    </Button>
                  </div>
                  <Textarea
                    rows={8}
                    value={guestUpdateJson}
                    onChange={(e) => setGuestUpdateJson(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Accounts */}
        <TabsContent value="accounts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Accounts (Travel Agents / Corporates)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">List Accounts</h3>
                  <Input
                    placeholder="Type (TRAVEL_AGENT, CORPORATE, ...)"
                    value={accountFilters.type}
                    onChange={(e) =>
                      setAccountFilters((f) => ({
                        ...f,
                        type: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="City"
                    value={accountFilters.city}
                    onChange={(e) =>
                      setAccountFilters((f) => ({
                        ...f,
                        city: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("accounts-list")}
                    onClick={() => {
                      const params = new URLSearchParams();
                      Object.entries(accountFilters).forEach(
                        ([key, value]) => {
                          if (value) params.append(key, value);
                        }
                      );
                      makeCall(
                        "accounts-list",
                        "GET /accounts",
                        "GET",
                        `/accounts${params.toString() ? `?${params.toString()}` : ""
                        }`
                      );
                    }}
                  >
                    {isLoading("accounts-list")
                      ? "Loading..."
                      : "Fetch Accounts"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Create / Update Account
                  </h3>
                  <Textarea
                    rows={6}
                    value={accountCreateJson}
                    onChange={(e) =>
                      setAccountCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("accounts-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(accountCreateJson);
                        makeCall(
                          "accounts-create",
                          "POST /accounts",
                          "POST",
                          "/accounts",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error("Invalid JSON in account create payload")
                        );
                      }
                    }}
                  >
                    {isLoading("accounts-create")
                      ? "Creating..."
                      : "Create Account"}
                  </Button>
                  <Input
                    placeholder="Account ID for update"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  />
                  <Textarea
                    rows={4}
                    value={accountUpdateJson}
                    onChange={(e) =>
                      setAccountUpdateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={!accountId || isLoading("accounts-update")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(accountUpdateJson);
                        makeCall(
                          "accounts-update",
                          `PATCH /accounts/${accountId}`,
                          "PATCH",
                          `/accounts/${accountId}`,
                          payload
                        );
                      } catch {
                        handleError(
                          new Error("Invalid JSON in account update payload")
                        );
                      }
                    }}
                  >
                    {isLoading("accounts-update")
                      ? "Updating..."
                      : "Update Account"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Properties & Regions */}
        <TabsContent value="properties" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Properties & Regions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Properties</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading("properties-list")}
                    onClick={() =>
                      makeCall(
                        "properties-list",
                        "GET /properties",
                        "GET",
                        "/properties"
                      )
                    }
                  >
                    {isLoading("properties-list")
                      ? "Loading..."
                      : "List Properties"}
                  </Button>
                  <Textarea
                    rows={6}
                    value={propertyCreateJson}
                    onChange={(e) =>
                      setPropertyCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("properties-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(propertyCreateJson);
                        makeCall(
                          "properties-create",
                          "POST /properties",
                          "POST",
                          "/properties",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in property create payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("properties-create")
                      ? "Creating..."
                      : "Create Property"}
                  </Button>
                  <Input
                    placeholder="Property ID for update"
                    value={propertyId}
                    onChange={(e) => setPropertyId(e.target.value)}
                  />
                  <Textarea
                    rows={4}
                    value={propertyUpdateJson}
                    onChange={(e) =>
                      setPropertyUpdateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={!propertyId || isLoading("properties-update")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(propertyUpdateJson);
                        makeCall(
                          "properties-update",
                          `PATCH /properties/${propertyId}`,
                          "PATCH",
                          `/properties/${propertyId}`,
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in property update payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("properties-update")
                      ? "Updating..."
                      : "Update Property"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Regions</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading("regions-list")}
                    onClick={() =>
                      makeCall(
                        "regions-list",
                        "GET /regions",
                        "GET",
                        "/regions"
                      )
                    }
                  >
                    {isLoading("regions-list")
                      ? "Loading..."
                      : "List Regions"}
                  </Button>
                  <Textarea
                    rows={6}
                    value={regionCreateJson}
                    onChange={(e) =>
                      setRegionCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("regions-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(regionCreateJson);
                        makeCall(
                          "regions-create",
                          "POST /regions",
                          "POST",
                          "/regions",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in region create payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("regions-create")
                      ? "Creating..."
                      : "Create Region"}
                  </Button>
                  <Input
                    placeholder="Region ID for update"
                    value={regionId}
                    onChange={(e) => setRegionId(e.target.value)}
                  />
                  <Textarea
                    rows={4}
                    value={regionUpdateJson}
                    onChange={(e) =>
                      setRegionUpdateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={!regionId || isLoading("regions-update")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(regionUpdateJson);
                        makeCall(
                          "regions-update",
                          `PATCH /regions/${regionId}`,
                          "PATCH",
                          `/regions/${regionId}`,
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in region update payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("regions-update")
                      ? "Updating..."
                      : "Update Region"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reservations */}
        <TabsContent value="reservations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Reservations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    List Reservations
                  </h3>
                  <Input
                    placeholder="Property ID"
                    value={reservationFilters.propertyId}
                    onChange={(e) =>
                      setReservationFilters((f) => ({
                        ...f,
                        propertyId: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Guest ID"
                    value={reservationFilters.guestId}
                    onChange={(e) =>
                      setReservationFilters((f) => ({
                        ...f,
                        guestId: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="From date"
                    value={reservationFilters.fromDate}
                    onChange={(e) =>
                      setReservationFilters((f) => ({
                        ...f,
                        fromDate: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="To date"
                    value={reservationFilters.toDate}
                    onChange={(e) =>
                      setReservationFilters((f) => ({
                        ...f,
                        toDate: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("reservations-list")}
                    onClick={() => {
                      const params = new URLSearchParams();
                      Object.entries(reservationFilters).forEach(
                        ([key, value]) => {
                          if (value) params.append(key, value);
                        }
                      );
                      makeCall(
                        "reservations-list",
                        "GET /reservations",
                        "GET",
                        `/reservations${params.toString() ? `?${params.toString()}` : ""
                        }`
                      );
                    }}
                  >
                    {isLoading("reservations-list")
                      ? "Loading..."
                      : "Fetch Reservations"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Create Reservation</h3>
                  <Input
                    placeholder="Lead ID"
                    value={reservationLeadId}
                    onChange={(e) =>
                      setReservationLeadId(e.target.value)
                    }
                  />
                  <Textarea
                    rows={6}
                    value={reservationCreateJson}
                    onChange={(e) =>
                      setReservationCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={
                      !reservationLeadId ||
                      isLoading("reservations-create")
                    }
                    onClick={() => {
                      try {
                        const payload = JSON.parse(reservationCreateJson);
                        makeCall(
                          "reservations-create",
                          "POST /reservations",
                          "POST",
                          "/reservations",
                          {
                            ...payload,
                            leadId: reservationLeadId,
                          }
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in reservation create payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("reservations-create")
                      ? "Creating..."
                      : "Create Reservation"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">List Tasks</h3>
                  <Input
                    placeholder="Owner User ID"
                    value={taskFilters.ownerUserId}
                    onChange={(e) =>
                      setTaskFilters((f) => ({
                        ...f,
                        ownerUserId: e.target.value,
                      }))
                    }
                  />
                  <Input
                    placeholder="Status (OPEN, COMPLETED, ...)"
                    value={taskFilters.status}
                    onChange={(e) =>
                      setTaskFilters((f) => ({
                        ...f,
                        status: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="Due from"
                    value={taskFilters.fromDue}
                    onChange={(e) =>
                      setTaskFilters((f) => ({
                        ...f,
                        fromDue: e.target.value,
                      }))
                    }
                  />
                  <Input
                    type="date"
                    placeholder="Due to"
                    value={taskFilters.toDue}
                    onChange={(e) =>
                      setTaskFilters((f) => ({
                        ...f,
                        toDue: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("tasks-list")}
                    onClick={() => {
                      const params = new URLSearchParams();
                      Object.entries(taskFilters).forEach(
                        ([key, value]) => {
                          if (value) params.append(key, value);
                        }
                      );
                      makeCall(
                        "tasks-list",
                        "GET /tasks",
                        "GET",
                        `/tasks${params.toString() ? `?${params.toString()}` : ""
                        }`
                      );
                    }}
                  >
                    {isLoading("tasks-list") ? "Loading..." : "Fetch Tasks"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Create / Update Task
                  </h3>
                  <Textarea
                    rows={6}
                    value={taskCreateJson}
                    onChange={(e) =>
                      setTaskCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("tasks-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(taskCreateJson);
                        makeCall(
                          "tasks-create",
                          "POST /tasks",
                          "POST",
                          "/tasks",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error("Invalid JSON in task create payload")
                        );
                      }
                    }}
                  >
                    {isLoading("tasks-create")
                      ? "Creating..."
                      : "Create Task"}
                  </Button>
                  <Input
                    placeholder="Task ID for update"
                    value={taskId}
                    onChange={(e) => setTaskId(e.target.value)}
                  />
                  <Textarea
                    rows={4}
                    value={taskUpdateJson}
                    onChange={(e) =>
                      setTaskUpdateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={!taskId || isLoading("tasks-update")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(taskUpdateJson);
                        makeCall(
                          "tasks-update",
                          `PATCH /tasks/${taskId}`,
                          "PATCH",
                          `/tasks/${taskId}`,
                          payload
                        );
                      } catch {
                        handleError(
                          new Error("Invalid JSON in task update payload")
                        );
                      }
                    }}
                  >
                    {isLoading("tasks-update")
                      ? "Updating..."
                      : "Update Task"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Buddies */}
        <TabsContent value="buddies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Buddy System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Assign Buddy</h3>
                  <Input
                    placeholder="User ID"
                    value={buddyUserId}
                    onChange={(e) =>
                      setBuddyUserId(e.target.value)
                    }
                  />
                  <Input
                    placeholder="Buddy User ID"
                    value={buddyBuddyUserId}
                    onChange={(e) =>
                      setBuddyBuddyUserId(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={
                      !buddyUserId ||
                      !buddyBuddyUserId ||
                      isLoading("buddies-assign")
                    }
                    onClick={() =>
                      makeCall(
                        "buddies-assign",
                        `POST /buddies/users/${buddyUserId}/buddy`,
                        "POST",
                        `/buddies/users/${buddyUserId}/buddy`,
                        { buddyUserId: buddyBuddyUserId }
                      )
                    }
                  >
                    {isLoading("buddies-assign")
                      ? "Assigning..."
                      : "Assign Buddy"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">Buddy Report</h3>
                  <Input
                    placeholder="User ID"
                    value={buddyReportUserId}
                    onChange={(e) =>
                      setBuddyReportUserId(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={
                      !buddyReportUserId ||
                      isLoading("buddies-report")
                    }
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.append("userId", buddyReportUserId);
                      // Note: route is /buddies/buddies/report because of router mount path
                      makeCall(
                        "buddies-report",
                        "GET /buddies/buddies/report",
                        "GET",
                        `/buddies/buddies/report?${params.toString()}`
                      );
                    }}
                  >
                    {isLoading("buddies-report")
                      ? "Loading..."
                      : "Get Buddy Report"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Workflows */}
        <TabsContent value="workflows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workflows</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">List Workflows</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isLoading("workflows-list")}
                    onClick={() =>
                      makeCall(
                        "workflows-list",
                        "GET /workflows",
                        "GET",
                        "/workflows"
                      )
                    }
                  >
                    {isLoading("workflows-list")
                      ? "Loading..."
                      : "Fetch Workflows"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Create / Update Workflow
                  </h3>
                  <Textarea
                    rows={6}
                    value={workflowCreateJson}
                    onChange={(e) =>
                      setWorkflowCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("workflows-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(workflowCreateJson);
                        makeCall(
                          "workflows-create",
                          "POST /workflows",
                          "POST",
                          "/workflows",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in workflow create payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("workflows-create")
                      ? "Creating..."
                      : "Create Workflow"}
                  </Button>
                  <Input
                    placeholder="Workflow ID for update"
                    value={workflowId}
                    onChange={(e) =>
                      setWorkflowId(e.target.value)
                    }
                  />
                  <Textarea
                    rows={4}
                    value={workflowUpdateJson}
                    onChange={(e) =>
                      setWorkflowUpdateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={
                      !workflowId || isLoading("workflows-update")
                    }
                    onClick={() => {
                      try {
                        const payload = JSON.parse(workflowUpdateJson);
                        makeCall(
                          "workflows-update",
                          `PATCH /workflows/${workflowId}`,
                          "PATCH",
                          `/workflows/${workflowId}`,
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in workflow update payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("workflows-update")
                      ? "Updating..."
                      : "Update Workflow"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Availability */}
        <TabsContent value="availability" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Availability Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Get Latest Report
                  </h3>
                  <Input
                    placeholder="Property ID"
                    value={availabilityPropertyId}
                    onChange={(e) =>
                      setAvailabilityPropertyId(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={
                      !availabilityPropertyId ||
                      isLoading("availability-latest")
                    }
                    onClick={() => {
                      const params = new URLSearchParams();
                      params.append("propertyId", availabilityPropertyId);
                      makeCall(
                        "availability-latest",
                        "GET /availability-reports/latest",
                        "GET",
                        `/availability-reports/latest?${params.toString()}`
                      );
                    }}
                  >
                    {isLoading("availability-latest")
                      ? "Loading..."
                      : "Fetch Latest Report"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold">
                    Upload Availability Report
                  </h3>
                  <Textarea
                    rows={8}
                    value={availabilityCreateJson}
                    onChange={(e) =>
                      setAvailabilityCreateJson(e.target.value)
                    }
                  />
                  <Button
                    size="sm"
                    disabled={isLoading("availability-create")}
                    onClick={() => {
                      try {
                        const payload = JSON.parse(availabilityCreateJson);
                        makeCall(
                          "availability-create",
                          "POST /availability-reports",
                          "POST",
                          "/availability-reports",
                          payload
                        );
                      } catch {
                        handleError(
                          new Error(
                            "Invalid JSON in availability create payload"
                          )
                        );
                      }
                    }}
                  >
                    {isLoading("availability-create")
                      ? "Uploading..."
                      : "Upload Report"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reports */}
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics Reports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-2">
                  <label className="text-xs font-medium">
                    Date for Daily Activity
                  </label>
                  <Input
                    type="date"
                    value={reportsDate}
                    onChange={(e) =>
                      setReportsDate(e.target.value)
                    }
                  />
                </div>
                <Button
                  size="sm"
                  disabled={isLoading("reports-daily-activity")}
                  onClick={() => {
                    const params = new URLSearchParams();
                    if (reportsDate) params.append("date", reportsDate);
                    makeCall(
                      "reports-daily-activity",
                      "GET /reports/daily-activity",
                      "GET",
                      `/reports/daily-activity${params.toString() ? `?${params.toString()}` : ""
                      }`
                    );
                  }}
                >
                  {isLoading("reports-daily-activity")
                    ? "Loading..."
                    : "Daily Activity"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading("reports-response-time")}
                  onClick={() =>
                    makeCall(
                      "reports-response-time",
                      "GET /reports/response-time",
                      "GET",
                      "/reports/response-time"
                    )
                  }
                >
                  {isLoading("reports-response-time")
                    ? "Loading..."
                    : "Response Time"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading("reports-conversions")}
                  onClick={() =>
                    makeCall(
                      "reports-conversions",
                      "GET /reports/conversions",
                      "GET",
                      "/reports/conversions"
                    )
                  }
                >
                  {isLoading("reports-conversions")
                    ? "Loading..."
                    : "Conversions"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading("reports-lost-reasons")}
                  onClick={() =>
                    makeCall(
                      "reports-lost-reasons",
                      "GET /reports/lost-reasons",
                      "GET",
                      "/reports/lost-reasons"
                    )
                  }
                >
                  {isLoading("reports-lost-reasons")
                    ? "Loading..."
                    : "Lost Reasons"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading("reports-lead-aging")}
                  onClick={() =>
                    makeCall(
                      "reports-lead-aging",
                      "GET /reports/lead-aging",
                      "GET",
                      "/reports/lead-aging"
                    )
                  }
                >
                  {isLoading("reports-lead-aging")
                    ? "Loading..."
                    : "Lead Aging"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isLoading("reports-buddy")}
                  onClick={() =>
                    makeCall(
                      "reports-buddy",
                      "GET /reports/buddy",
                      "GET",
                      "/reports/buddy"
                    )
                  }
                >
                  {isLoading("reports-buddy")
                    ? "Loading..."
                    : "Buddy Metrics"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Last response viewer */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm">
              Last API Response
            </CardTitle>
            {lastResponse && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">
                  {lastResponse.method} {lastResponse.path}
                </Badge>
                <span>{lastResponse.timestamp}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {lastResponse ? (
            <ScrollArea className="h-80 rounded-md border bg-muted p-3">
              <pre className="whitespace-pre-wrap text-xs">
                {JSON.stringify(lastResponse.data, null, 2)}
              </pre>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">
              No requests made yet. Use the console above to call an
              endpoint.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
