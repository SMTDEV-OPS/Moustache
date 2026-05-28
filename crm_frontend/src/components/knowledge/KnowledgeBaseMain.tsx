import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { PropertyGuideView } from "./PropertyGuideView";
import { KnowledgeHubLanding } from "./KnowledgeHubLanding";

interface Property {
  _id: string;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
}

interface KnowledgeBaseMainProps {
  isAdmin?: boolean;
  permissions?: string[];
}

export const KnowledgeBaseMain = ({
  isAdmin,
  permissions,
}: KnowledgeBaseMainProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [sectionHash, setSectionHash] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);

  const canManage =
    !!isAdmin ||
    permissions?.includes("knowledge-base.manage") ||
    permissions?.includes("knowledgebase.manage");

  useEffect(() => {
    const fetchProperties = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/properties`, {
          headers: withAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setProperties(
            Array.isArray(data)
              ? data.filter((p: Property) => p.status === "ACTIVE")
              : []
          );
        }
      } catch (error) {
        console.error("Failed to fetch properties:", error);
      } finally {
        setLoading(false);
      }
    };

    void fetchProperties();
  }, []);

  useEffect(() => {
    if (sectionHash) {
      const el = document.getElementById(sectionHash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, [sectionHash, selectedPropertyId]);

  const selectedProperty = properties.find((p) => p._id === selectedPropertyId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }

  if (!selectedPropertyId) {
    return (
      <KnowledgeHubLanding
        canManage={canManage}
        onSelectProperty={(id, hash) => {
          setSelectedPropertyId(id);
          setSectionHash(hash);
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 px-6 pt-6">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSelectedPropertyId("");
            setSectionHash(undefined);
          }}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          All properties
        </Button>
      </div>
      <PropertyGuideView
        propertyId={selectedPropertyId}
        propertyName={selectedProperty?.name}
        propertyCode={selectedProperty?.code}
        canManage={canManage}
      />
    </div>
  );
};
