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
});

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
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).$onUpdate(() => new Date()),
});

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  icon: text("icon"),
  privacy: text("privacy", { enum: ["public", "members_only", "private"] }).notNull().default("public"),
  isFeatured: integer("is_featured").notNull().default(0),
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
