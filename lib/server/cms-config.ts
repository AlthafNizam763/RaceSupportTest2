import type { AnyZodObject } from "zod";

import {
  ActionPlanSchema,
  ChangemakerSchema,
  EventSchema,
  GallerySchema,
  SettingsSchema,
  TeamMemberSchema,
  TicketSchema,
} from "@/lib/api/schemas";

export type CmsCollectionKey =
  | "events"
  | "courses"
  | "projects"
  | "observations"
  | "collaborations"
  | "news"
  | "team"
  | "changemakers"
  | "gallery"
  | "tickets"
  | "settings";

export interface CmsCollectionConfig {
  key: CmsCollectionKey;
  collectionName: string;
  schema: AnyZodObject;
  sortable?: boolean;
  singleton?: boolean;
}

const COLLECTIONS: Record<CmsCollectionKey, CmsCollectionConfig> = {
  events: {
    key: "events",
    collectionName: "events",
    schema: EventSchema,
    sortable: true,
  },
  courses: {
    key: "courses",
    collectionName: "courses",
    schema: ActionPlanSchema,
    sortable: true,
  },
  projects: {
    key: "projects",
    collectionName: "projects",
    schema: ActionPlanSchema,
    sortable: true,
  },
  observations: {
    key: "observations",
    collectionName: "observations",
    schema: ActionPlanSchema,
    sortable: true,
  },
  collaborations: {
    key: "collaborations",
    collectionName: "collaborations",
    schema: ActionPlanSchema,
    sortable: true,
  },
  news: {
    key: "news",
    collectionName: "news",
    schema: ActionPlanSchema,
    sortable: true,
  },
  team: {
    key: "team",
    collectionName: "team_members",
    schema: TeamMemberSchema,
    sortable: true,
  },
  changemakers: {
    key: "changemakers",
    collectionName: "changemakers",
    schema: ChangemakerSchema,
    sortable: true,
  },
  gallery: {
    key: "gallery",
    collectionName: "gallery",
    schema: GallerySchema,
    sortable: true,
  },
  tickets: {
    key: "tickets",
    collectionName: "tickets",
    schema: TicketSchema,
    sortable: true,
  },
  settings: {
    key: "settings",
    collectionName: "settings",
    schema: SettingsSchema,
    singleton: true,
  },
};

const COLLECTION_ALIASES: Record<string, CmsCollectionKey> = {
  team_members: "team",
};

export function resolveCmsCollection(input: string) {
  const key = COLLECTION_ALIASES[input] ?? input;
  return COLLECTIONS[key as CmsCollectionKey] ?? null;
}

export function listCmsCollections() {
  return Object.values(COLLECTIONS);
}
