import { z } from "zod";

const optionalText = z.string().optional().default("");
const optionalUrl = z.string().trim().url("Valid URL required").or(z.literal("")).optional().default("");
const optionalStringArray = z.array(z.string().trim()).optional().default([]);
const optionalOrder = z.number().int().nonnegative().optional();

export const ActionPlanSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  description: optionalText,
  images: optionalStringArray,
  order: optionalOrder,
});

export const EventSchema = ActionPlanSchema.extend({
  date: optionalText,
  status: z.enum(["Ongoing", "Past"]).optional().default("Ongoing"),
});

export const TeamMemberSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  role: z.string().trim().min(1, "Role is required"),
  image: optionalText,
  points: z.number().int().nonnegative().optional(),
  link: optionalUrl,
  description: optionalText,
  type: z.enum(["leader", "it", "it-media"]).optional().default("leader"),
  order: optionalOrder,
});

export const ChangemakerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  title: z.string().trim().min(1, "Title is required"),
  image: optionalText,
  order: optionalOrder,
});

export const GallerySchema = z.object({
  title: optionalText,
  type: z.enum(["image", "video"]),
  url: z.string().trim().min(1, "Media URL is required"),
  path: optionalText,
  fileName: optionalText,
  contentType: optionalText,
  size: z.number().int().nonnegative().optional(),
  order: optionalOrder,
});

export const TicketSchema = z.object({
  subject: z.string().trim().min(1, "Subject is required"),
  message: z.string().trim().min(1, "Message is required"),
  userName: z.string().trim().min(1, "User name is required"),
  userEmail: z.string().trim().email("Valid email required"),
  status: z.enum(["Open", "In Progress", "Resolved"]).optional().default("Open"),
  order: optionalOrder,
});

export const SettingsSchema = z.object({
  siteName: z.string().trim().min(1, "Site name is required"),
  contactEmail: z.string().trim().email("Valid email required"),
  contactPhone: optionalText,
  address: optionalText,
  instagram: optionalUrl,
  linkedin: optionalUrl,
  facebook: optionalUrl,
  twitter: optionalUrl,
});

export const ReorderSchema = z.array(
  z.object({
    id: z.string().trim().min(1),
    order: z.number().int().nonnegative(),
  })
);

export const AdminUserCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  email: z.string().trim().email("Valid email required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["admin", "editor", "viewer"]),
});

export const AdminUserUpdateSchema = z.object({
  role: z.enum(["admin", "editor", "viewer"]).optional(),
  disabled: z.boolean().optional(),
});

