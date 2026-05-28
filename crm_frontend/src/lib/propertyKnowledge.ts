import {
  fetchPropertyGuide,
  fetchPublicPropertyGuide,
  type PropertyGuideContent,
  type PropertyGuidePayload,
} from "@/services/knowledgeBase";

export type {
  PropertyGuideContent,
  PropertyGuidePayload,
} from "@/services/knowledgeBase";

export type KnowledgeRateRow = { room: string; rate: string };

export interface MergedPropertyKnowledge {
  propertyId: string;
  propertyName: string;
  propertyCode?: string;
  location?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  roomCategories?: string;
  rates: KnowledgeRateRow[];
  contact: { phone?: string; email?: string; website?: string };
  amenities: string[];
  facilities: string[];
  attractions?: string;
  tours?: string;
  experienceNotes?: string;
  speciality?: string;
  marketingPitch?: string;
  mediaLinks: {
    photosDriveUrl?: string;
    brochure?: string;
    salesDeck?: string;
    factSheet?: string;
    cancellationPolicy?: string;
  };
  policies: Array<{ title: string; body: string }>;
  galleryUrls: Array<{ fileId: string; url: string; caption?: string }>;
  thumbnailUrl?: string;
  guideId?: string;
  shareToken?: string;
  shareEnabled: boolean;
  lastUpdated?: string;
}

function payloadToMerged(p: PropertyGuidePayload): MergedPropertyKnowledge {
  const c = p.content || {};
  return {
    propertyId: p.propertyId,
    propertyName: p.propertyName,
    propertyCode: p.propertyCode,
    location: c.location,
    city: p.city,
    state: p.state,
    propertyType: c.propertyType,
    roomCategories: c.roomCategories,
    rates: c.rates || [],
    contact: c.contact || {},
    amenities: c.amenities || [],
    facilities: c.facilities || [],
    attractions: c.experiences?.attractions,
    tours: c.experiences?.tours,
    experienceNotes: c.experiences?.notes,
    speciality: c.sellingStory?.speciality,
    marketingPitch: c.sellingStory?.marketingPitch,
    mediaLinks: { photosDriveUrl: c.legacyDriveUrl },
    policies: c.policies || [],
    galleryUrls: p.galleryUrls || [],
    thumbnailUrl: p.thumbnailUrl,
    guideId: p.guideId,
    shareToken: p.shareToken,
    shareEnabled: p.shareEnabled,
    lastUpdated: p.lastUpdated,
  };
}

export async function fetchPropertyKnowledgeBundle(
  propertyId: string,
  propertyMeta?: { name?: string; code?: string }
): Promise<MergedPropertyKnowledge> {
  const payload = await fetchPropertyGuide(propertyId);
  if (propertyMeta?.name) payload.propertyName = propertyMeta.name;
  if (propertyMeta?.code) payload.propertyCode = propertyMeta.code;
  return payloadToMerged(payload);
}

export async function fetchPublicPropertyKnowledgeBundle(
  shareToken: string
): Promise<MergedPropertyKnowledge> {
  const payload = await fetchPublicPropertyGuide(shareToken);
  return payloadToMerged(payload);
}

export function knowledgeMatchesSearch(data: MergedPropertyKnowledge, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  const haystack = [
    data.propertyName,
    data.location,
    data.city,
    data.state,
    data.roomCategories,
    data.speciality,
    data.marketingPitch,
    data.attractions,
    data.tours,
    ...data.amenities,
    ...data.facilities,
    ...data.rates.map((r) => `${r.room} ${r.rate}`),
    ...data.policies.map((p) => `${p.title} ${p.body}`),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}

export function mergedToContent(data: MergedPropertyKnowledge): PropertyGuideContent {
  return {
    contact: data.contact,
    roomCategories: data.roomCategories,
    rates: data.rates,
    amenities: data.amenities,
    facilities: data.facilities,
    experiences: {
      attractions: data.attractions,
      tours: data.tours,
      notes: data.experienceNotes,
    },
    sellingStory: {
      speciality: data.speciality,
      marketingPitch: data.marketingPitch,
    },
    policies: data.policies,
    legacyDriveUrl: data.mediaLinks.photosDriveUrl,
    propertyType: data.propertyType,
    location: data.location,
  };
}
