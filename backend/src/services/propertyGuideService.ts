import { randomUUID } from "crypto";
import { Types, isValidObjectId } from "mongoose";
import { badRequest } from "../utils/httpError";
import {
  KnowledgeBaseModel,
  KnowledgeBaseType,
  IKnowledgeBase,
  IKnowledgeBaseFile,
} from "../models/knowledgeBase";
import { PropertyModel } from "../models/property";
import { StorageService } from "./storageService";
import { notFound } from "../utils/httpError";

export interface PropertyGuideContent {
  contact?: { phone?: string; email?: string; website?: string };
  roomCategories?: string;
  rates?: Array<{ room: string; rate: string }>;
  amenities?: string[];
  facilities?: string[];
  experiences?: { attractions?: string; tours?: string; notes?: string };
  sellingStory?: { speciality?: string; marketingPitch?: string };
  policies?: Array<{ title: string; body: string }>;
  gallery?: Array<{ fileId: string; caption?: string; sortOrder: number }>;
  legacyDriveUrl?: string;
  propertyType?: string;
  location?: string;
}

function asString(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s || undefined;
}

function asStringList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(/\n+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}

export async function getSignedFileUrl(file: IKnowledgeBaseFile): Promise<string | undefined> {
  if (file.storageType === "S3" && file.s3Key) {
    try {
      return await StorageService.getSignedUrl(file.s3Key);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

async function legacyMergeContent(propertyId: Types.ObjectId): Promise<PropertyGuideContent> {
  const pid = String(propertyId);
  const [propertyItems, factItems, templateItems, resourceItems] = await Promise.all([
    KnowledgeBaseModel.find({ propertyId, type: KnowledgeBaseType.PROPERTY, isActive: true }).lean(),
    KnowledgeBaseModel.find({ propertyId, type: KnowledgeBaseType.FACTSHEET, isActive: true }).lean(),
    KnowledgeBaseModel.find({ propertyId, type: KnowledgeBaseType.TEMPLATE, isActive: true }).lean(),
    KnowledgeBaseModel.find({ propertyId, type: KnowledgeBaseType.RESOURCE, isActive: true }).lean(),
  ]);

  const pc = (propertyItems[0]?.content || {}) as Record<string, unknown>;
  const fc = (factItems[0]?.content || {}) as Record<string, unknown>;
  const tc = (templateItems[0]?.content || {}) as Record<string, unknown>;
  const rc = (resourceItems[0]?.content || {}) as Record<string, unknown>;

  const ratesObj = (pc.rates || {}) as Record<string, string>;
  const rates = Object.entries(ratesObj).map(([room, rate]) => ({
    room: room.replace(/_/g, " "),
    rate: String(rate),
  }));

  const policies: Array<{ title: string; body: string }> = [];
  const policyFields: Array<[string, string]> = [
    ["Policy documents", "policyDocuments"],
    ["Training material", "trainingMaterial"],
    ["Brand guidelines", "brandGuideline"],
    ["Communication guidelines", "communicationGuidelines"],
    ["SOPs", "sopByDepartment"],
    ["Cancellation policy", "cancellationPolicy"],
  ];
  for (const [title, key] of policyFields) {
    const body = asString(rc[key]) || asString(tc[key]);
    if (body) policies.push({ title, body });
  }

  let legacyDriveUrl = asString((pc.mediaLinks as { photosDriveUrl?: string })?.photosDriveUrl);
  if (!legacyDriveUrl) legacyDriveUrl = asString(tc.driveLink);

  return {
    contact: {
      phone: asString((pc.contact as { phone?: string })?.phone),
      email: asString((pc.contact as { phone?: string; email?: string })?.email),
      website: asString((pc.contact as { website?: string })?.website),
    },
    roomCategories: asString(pc.roomCategory) || asString(fc["Room Categories"]),
    rates,
    amenities: [...asStringList(pc.amenities), ...asStringList(fc.Amenities)],
    facilities: asStringList(pc.facilities).length ? asStringList(pc.facilities) : asStringList(fc.Facilities),
    experiences: {
      attractions: asString(fc["Nearby Attractions"]),
      tours: asString(fc["Special Tours"]),
      notes: asString(fc["Experience Notes"]),
    },
    sellingStory: {
      speciality: asString(pc.speciality) || asString(fc["Speciality of the hotel"]),
      marketingPitch: asString(pc.marketingPitch) || asString(fc["Selling/Marketing Pitch"]),
    },
    policies,
    legacyDriveUrl,
    propertyType: asString(pc.type),
    location: asString(pc.location),
    gallery: [],
  };
}

export async function findGuideByPropertyId(propertyId: string): Promise<IKnowledgeBase | null> {
  const item = await KnowledgeBaseModel.findOne({
    propertyId: new Types.ObjectId(propertyId),
    type: KnowledgeBaseType.PROPERTY_GUIDE,
    isActive: true,
  })
    .populate("propertyId", "name code location")
    .lean();
  return item as unknown as IKnowledgeBase | null;
}

export async function resolveGuideWithUrls(guide: IKnowledgeBase) {
  const content = (guide.content || {}) as PropertyGuideContent;
  const galleryMeta = content.gallery || [];
  const galleryUrls: Array<{ fileId: string; url: string; caption?: string }> = [];

  for (const g of galleryMeta.sort((a, b) => a.sortOrder - b.sortOrder)) {
    const file = guide.files?.find((f) => String(f._id) === g.fileId);
    if (!file || !file.mimeType?.startsWith("image/")) continue;
    const url = await getSignedFileUrl(file);
    if (url) galleryUrls.push({ fileId: g.fileId, url, caption: g.caption });
  }

  if (galleryUrls.length === 0 && guide.files?.length) {
    let order = 0;
    for (const file of guide.files) {
      if (!file.mimeType?.startsWith("image/")) continue;
      const url = await getSignedFileUrl(file);
      if (url && file._id) {
        galleryUrls.push({
          fileId: String(file._id),
          url,
          caption: file.originalName,
        });
        order++;
      }
    }
  }

  const thumbnailUrl = galleryUrls[0]?.url;

  return {
    guide,
    content,
    galleryUrls,
    thumbnailUrl,
  };
}

export async function getGuidePayloadForProperty(propertyId: string, propertyMeta?: { name?: string; code?: string }) {
  if (!isValidObjectId(propertyId)) {
    throw badRequest("Invalid property id");
  }
  let guide = await findGuideByPropertyId(propertyId);
  if (!guide) {
    const merged = await legacyMergeContent(new Types.ObjectId(propertyId));
    const prop = await PropertyModel.findById(propertyId).lean();
    return {
      guide: null,
      propertyId,
      propertyName: propertyMeta?.name || prop?.name || "Property",
      propertyCode: propertyMeta?.code || prop?.code,
      city: prop?.location?.city,
      state: prop?.location?.state,
      content: merged,
      galleryUrls: [] as Array<{ fileId: string; url: string; caption?: string }>,
      thumbnailUrl: undefined as string | undefined,
      shareToken: undefined as string | undefined,
      shareEnabled: false,
      guideId: undefined as string | undefined,
      lastUpdated: undefined as string | undefined,
    };
  }

  const resolved = await resolveGuideWithUrls(guide);
  const prop = guide.propertyId as unknown as { name?: string; code?: string; location?: { city?: string; state?: string } };
  return {
    guide,
    guideId: String(guide._id),
    propertyId,
    propertyName: propertyMeta?.name || prop?.name || guide.title.replace(/ - Property Guide$/i, ""),
    propertyCode: propertyMeta?.code || prop?.code,
    city: prop?.location?.city,
    state: prop?.location?.state,
    content: resolved.content,
    galleryUrls: resolved.galleryUrls,
    thumbnailUrl: resolved.thumbnailUrl,
    shareToken: guide.shareEnabled ? guide.shareToken : undefined,
    shareEnabled: !!guide.shareEnabled,
    lastUpdated: guide.updatedAt ? new Date(guide.updatedAt).toISOString() : undefined,
  };
}

export async function upsertPropertyGuide(
  propertyId: string,
  content: PropertyGuideContent,
  userId: string,
  options?: { shareEnabled?: boolean; regenerateShareToken?: boolean }
) {
  const prop = await PropertyModel.findById(propertyId);
  if (!prop) throw notFound("Property not found");

  const title = `${prop.name} - Property Guide`;
  let existing = await KnowledgeBaseModel.findOne({
    propertyId: new Types.ObjectId(propertyId),
    type: KnowledgeBaseType.PROPERTY_GUIDE,
  });

  let shareToken = existing?.shareToken;
  if (!shareToken || options?.regenerateShareToken) {
    shareToken = randomUUID().replace(/-/g, "");
  }

  const shareEnabled = options?.shareEnabled ?? existing?.shareEnabled ?? false;

  const update = {
    title,
    description: `Property guide for ${prop.name}`,
    content,
    shareToken,
    shareEnabled,
    isActive: true,
    updatedBy: new Types.ObjectId(userId),
  };

  if (existing) {
    existing = await KnowledgeBaseModel.findByIdAndUpdate(existing._id, { $set: update }, { new: true });
  } else {
    existing = await KnowledgeBaseModel.create({
      ...update,
      type: KnowledgeBaseType.PROPERTY_GUIDE,
      propertyId: new Types.ObjectId(propertyId),
      createdBy: new Types.ObjectId(userId),
      files: [],
    });
  }

  return existing!;
}

export async function getHubList() {
  const properties = await PropertyModel.find({ status: "ACTIVE" }).sort({ name: 1 }).lean();
  const guides = await KnowledgeBaseModel.find({
    type: KnowledgeBaseType.PROPERTY_GUIDE,
    isActive: true,
  }).lean();

  const guideByProperty = new Map(guides.map((g) => [String(g.propertyId), g]));

  const items = await Promise.all(
    properties.map(async (p) => {
      const guide = guideByProperty.get(String(p._id));
      let thumbnailUrl: string | undefined;
      let hasGuide = false;
      if (guide) {
        hasGuide = true;
        const resolved = await resolveGuideWithUrls(guide as unknown as IKnowledgeBase);
        thumbnailUrl = resolved.thumbnailUrl;
      }
      return {
        propertyId: String(p._id),
        name: p.name,
        code: p.code,
        city: p.location?.city,
        state: p.location?.state,
        country: p.location?.country,
        thumbnailUrl,
        hasGuide,
      };
    })
  );

  return items;
}

function contentSearchHaystack(content: PropertyGuideContent): string {
  return JSON.stringify(content).toLowerCase();
}

export async function searchKnowledgeBase(q: string) {
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const properties = await PropertyModel.find({
    status: "ACTIVE",
    $or: [{ name: regex }, { code: regex }, { "location.city": regex }],
  })
    .limit(10)
    .lean();

  const propertyResults = properties.map((p) => ({
    propertyId: String(p._id),
    propertyName: p.name,
    city: p.location?.city,
    sectionId: undefined as string | undefined,
    label: "Property",
    snippet: [p.location?.city, p.location?.state].filter(Boolean).join(", "),
  }));

  const guides = await KnowledgeBaseModel.find({
    type: KnowledgeBaseType.PROPERTY_GUIDE,
    isActive: true,
  })
    .populate("propertyId", "name code location")
    .lean();

  const matches: Array<{
    propertyId: string;
    propertyName: string;
    sectionId?: string;
    label: string;
    snippet: string;
  }> = [];

  const sectionDefs: Array<{ id: string; label: string; extract: (c: PropertyGuideContent) => string }> = [
    { id: "contact", label: "Contact", extract: (c) => JSON.stringify(c.contact || {}) },
    { id: "rooms", label: "Rooms & rates", extract: (c) => `${c.roomCategories || ""} ${JSON.stringify(c.rates || [])}` },
    { id: "amenities", label: "Amenities", extract: (c) => [...(c.amenities || []), ...(c.facilities || [])].join(" ") },
    { id: "experiences", label: "Experiences", extract: (c) => JSON.stringify(c.experiences || {}) },
    { id: "story", label: "Selling story", extract: (c) => JSON.stringify(c.sellingStory || {}) },
    { id: "policies", label: "Policies", extract: (c) => JSON.stringify(c.policies || []) },
  ];

  for (const guide of guides) {
    const content = (guide.content || {}) as PropertyGuideContent;
    const prop = guide.propertyId as unknown as { _id?: Types.ObjectId; name?: string };
    const propertyName = prop?.name || guide.title;
    const propertyId = String(prop?._id || guide.propertyId);

    if (contentSearchHaystack(content).includes(q.toLowerCase())) {
      for (const sec of sectionDefs) {
        const text = sec.extract(content);
        if (text.toLowerCase().includes(q.toLowerCase())) {
          matches.push({
            propertyId,
            propertyName,
            sectionId: sec.id,
            label: sec.label,
            snippet: text.slice(0, 120),
          });
          break;
        }
      }
    }
  }

  return { properties: propertyResults, matches: matches.slice(0, 15) };
}

export async function getPublicGuideByToken(shareToken: string) {
  const guide = await KnowledgeBaseModel.findOne({
    shareToken,
    shareEnabled: true,
    type: KnowledgeBaseType.PROPERTY_GUIDE,
    isActive: true,
  }).lean();

  if (!guide) throw notFound("Shared guide not found or disabled");

  const propertyId = String(guide.propertyId);
  const prop = await PropertyModel.findById(propertyId).lean();
  const payload = await getGuidePayloadForProperty(propertyId, {
    name: prop?.name,
    code: prop?.code,
  });

  return payload;
}

export async function migratePropertyToGuide(propertyId: Types.ObjectId, userId: Types.ObjectId) {
  const content = await legacyMergeContent(propertyId);
  const prop = await PropertyModel.findById(propertyId).lean();
  if (!prop) return null;

  await upsertPropertyGuide(String(propertyId), content, String(userId));

  await KnowledgeBaseModel.updateMany(
    {
      propertyId,
      type: { $in: [KnowledgeBaseType.PROPERTY, KnowledgeBaseType.FACTSHEET, KnowledgeBaseType.TEMPLATE, KnowledgeBaseType.RESOURCE] },
    },
    { $set: { isActive: false } }
  );

  return content;
}
