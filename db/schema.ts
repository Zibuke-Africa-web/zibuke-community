import { sql } from "drizzle-orm";
import {
  integer,
  check,
  index,
  uniqueIndex,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email"),
  emailVerified: integer("email_verified", { mode: "timestamp_ms" }),
  image: text("profile_picture_url"),
  role: text("role").notNull().default("member"),
  isVerifiedPartner: integer("is_verified_partner", { mode: "boolean" }).notNull().default(false),
  businessName: text("business_name"),
  businessCategory: text("business_category"),
  locationCity: text("location_city").notNull().default("Secunda"),
  whatsappNumber: text("whatsapp_number"),
  points: integer("points").notNull().default(0),
  currentStreak: integer("current_streak").notNull().default(1),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" }),
  badgeTitle: text("badge_title"),
  skills: text("skills", { mode: "json" })
    .$type<string[]>()
    .notNull()
    .default([]),
  avatarUrl: text("avatar_url"),
  bio: text("bio"),
  phone: text("phone"),
  location: text("location"),
  facebookUrl: text("facebook_url"),
  instagramUrl: text("instagram_url"),
  tiktokUrl: text("tiktok_url"),
  website: text("website"),
  coverPhotoUrl: text("cover_photo_url"),
  websiteUrl: text("website_url"),
  employmentStatus: text("employment_status"),
  profilePhotoUrl: text("profile_photo_url"),
  socialLinks: text("social_links", { mode: "json" })
    .$type<Record<string, string>>()
    .notNull()
    .default({}),
}, table => [
  index("users_directory_city_category_idx").on(table.locationCity, table.businessCategory, table.name, table.id),
  index("users_points_idx").on(table.points, table.lastActiveAt, table.id),
  index("users_active_idx").on(table.lastActiveAt),
]);

// One friendship per unordered pair; requester/addressee preserve its direction.
export const connections = sqliteTable(
  "connections",
  {
    requesterId: text("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    addresseeId: text("addressee_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status", { enum: ["pending", "accepted", "blocked"] }).notNull().default("pending"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
    // Drizzle initializes/refreshes this on writes; raw SQL must set it explicitly.
    updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => new Date()),
  },
  (table) => [
    primaryKey({ columns: [table.requesterId, table.addresseeId] }),
    check("connections_no_self", sql`${table.requesterId} <> ${table.addresseeId}`),
    check("connections_valid_status", sql`${table.status} in ('pending', 'accepted', 'blocked')`),
    uniqueIndex("connections_pair_unique").on(
      sql`min(${table.requesterId}, ${table.addresseeId})`,
      sql`max(${table.requesterId}, ${table.addresseeId})`,
    ),
    index("connections_incoming_status_idx").on(table.addresseeId, table.status),
  ],
);

export const accounts = sqliteTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
);

export const sessions = sqliteTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
});

export const verificationTokens = sqliteTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: integer("expires", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
);

export const groups = sqliteTable("groups", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  privacy: text("privacy").notNull().default("public"),
  visibility: text("visibility").notNull().default("visible"),
});

export const posts = sqliteTable("posts", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  groupId: text("group_id").references(() => groups.id, {
    onDelete: "set null",
  }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => new Date()),
}, (table) => [index("posts_space_created_idx").on(table.spaceId, table.createdAt, table.id)]);

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  icon: text("icon"),
  privacy: text("privacy", { enum: ["public", "members_only", "private"] }).notNull().default("public"),
  isFeatured: integer("is_featured").notNull().default(0),
  isPaywalled: integer("is_paywalled", { mode: "boolean" }).notNull().default(false),
  currency: text("currency", { enum: ["ZAR", "USD"] }).notNull().default("ZAR"),
  monthlyPriceCents: integer("monthly_price_cents").notNull().default(0),
  annualPriceCents: integer("annual_price_cents").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  check("spaces_valid_privacy", sql`${table.privacy} in ('public', 'members_only', 'private')`),
]);

export const spaceMembers = sqliteTable("space_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text("space_id").notNull().references(() => spaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"),
  joinedAt: integer("joined_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, (table) => [
  uniqueIndex("space_members_space_user_unique").on(table.spaceId, table.userId),
  index("space_members_user_idx").on(table.userId),
]);

export const dailySparks = sqliteTable("daily_sparks", {
  id: text("id").primaryKey(),
  topic: text("topic").notNull(),
  prompt: text("prompt").notNull(),
  actionText: text("action_text"),
  targetSpaceSlug: text("target_space_slug").notNull().default("welcome"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
}, (table) => [
  index("daily_sparks_created_idx").on(table.createdAt),
  uniqueIndex("daily_sparks_one_active").on(table.isActive).where(sql`${table.isActive} = 1`),
  check("daily_sparks_active_boolean", sql`${table.isActive} in (0, 1)`),
]);

export const events = sqliteTable("events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
  title: text("title").notNull(), description: text("description").notNull(), hostName: text("host_name").notNull(),
  startTime: integer("start_time", { mode: "timestamp" }).notNull(),
  meetUrl: text("meet_url"), isVirtual: integer("is_virtual", { mode: "boolean" }).notNull().default(true),
  coverImage: text("cover_image"),
}, table => [index("events_upcoming_idx").on(table.startTime, table.id), index("events_space_start_idx").on(table.spaceId, table.startTime)]);

export const eventRsvps = sqliteTable("event_rsvps", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, table => [uniqueIndex("event_rsvps_event_user_unique").on(table.eventId, table.userId), index("event_rsvps_user_idx").on(table.userId)]);

export const subscriptions = sqliteTable("subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceSlug: text("space_slug").notNull().references(() => spaces.slug, { onDelete: "cascade" }),
  gateway: text("gateway", { enum: ["peach_payments", "ikhokha"] }).notNull(),
  billingCycle: text("billing_cycle", { enum: ["monthly", "annual"] }).notNull(),
  status: text("status", { enum: ["active", "canceled", "expired"] }).notNull().default("expired"),
  currentPeriodEnd: integer("current_period_end", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
  registrationId: text("registration_id"),
  scheduleId: text("schedule_id"),
}, table => [
  index("subscriptions_access_idx").on(table.userId, table.spaceSlug, table.status, table.currentPeriodEnd),
  uniqueIndex("subscriptions_schedule_unique").on(table.scheduleId),
]);

// Prices and identity are fixed before redirecting to the gateway. Never trust callback metadata for ownership.
export const paymentOrders = sqliteTable("payment_orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  spaceSlug: text("space_slug").notNull().references(() => spaces.slug),
  gateway: text("gateway", { enum: ["peach_payments", "ikhokha"] }).notNull(),
  billingCycle: text("billing_cycle", { enum: ["monthly", "annual"] }).notNull(),
  amountCents: integer("amount_cents").notNull(), currency: text("currency").notNull(),
  providerId: text("provider_id"), checkoutUrl: text("checkout_url"),
  status: text("status", { enum: ["pending", "paid", "failed"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
}, table => [uniqueIndex("payment_orders_provider_unique").on(table.gateway, table.providerId), index("payment_orders_user_idx").on(table.userId, table.createdAt)]);

export const paymentReceipts = sqliteTable("payment_receipts", {
  id: text("id").primaryKey(), // gateway + transaction ID, not delivery ID
  orderId: text("order_id").notNull().references(() => paymentOrders.id),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});
