export type SpaceError = "UNAUTHORIZED" | "NOT_FOUND" | "FORBIDDEN" | "MEMBERSHIP_REQUIRED" | "INVALID_INPUT" | "INVALID_CONTENT" | "INVALID_MEDIA" | "HOST_MEMBERSHIP" | "UNAVAILABLE";
export type SpaceResult<T> = { success: true; data: T } | { success: false; error: SpaceError };
export type SpaceDetails = {
  id: string; slug: string; name: string; tagline: string | null; description: string | null;
  icon: string | null; privacy: "public" | "members_only" | "private";
  memberCount: number; isMember: boolean; role: string | null;
};
export type SpacePost = {
  id: string; content: string; mediaUrl: string | null; createdAt: string;
  author: { id: string; name: string; initials: string; image: string | null };
};
