export type Space = {
  id: string; slug: string; name: string; tag: string; description: string;
  icon: string; privacy: "public" | "members_only" | "private";
  members: number; featured: boolean; joined: boolean;
};

export const defaultSpaces: Space[] = [
  { id: "preview-welcome", slug: "welcome", name: "Welcome & Introductions", tag: "General", description: "Meet your neighbours, share your story, and find your place in the community.", icon: "Users", privacy: "public", members: 42, featured: false, joined: false },
  { id: "preview-business", slug: "business", name: "Local Business & Hustles", tag: "Local Hub", description: "Support local businesses, share your hustle, and build connections close to home.", icon: "BriefcaseBusiness", privacy: "public", members: 28, featured: false, joined: false },
  { id: "preview-home", slug: "home-and-garden", name: "Home & Garden Care", tag: "Partner Space - Zibuke OnCall", description: "Find practical home and garden advice with your community and Zibuke OnCall.", icon: "House", privacy: "public", members: 35, featured: true, joined: false },
  { id: "preview-builders", slug: "builders", name: "Founders & Builders", tag: "Private Cohort", description: "Share what you are building, exchange feedback, and find your next collaborator.", icon: "Lightbulb", privacy: "members_only", members: 19, featured: false, joined: false },
];

export function topicFor(slug: string) {
  switch (slug) {
    case "welcome": return { title: "Start with a hello", prompt: "Tell us your name, your neighbourhood, and one thing you would love to learn or share here.", discussions: ["What makes your neighbourhood feel like home?", "Share one local place everyone should know."] };
    case "business": return { title: "Put your local hustle on the map", prompt: "What do you offer, who do you help, and what kind of connection would help your business grow?", discussions: ["Introduce your business in three sentences.", "What did you learn from your first customer?"] };
    case "home-and-garden": return { title: "Welcome to Zibuke OnCall garden care", prompt: "Interested in Zibuke OnCall garden packages? Share your garden size, the care you need, and questions for the team. Package details will be shared here when available.", discussions: ["What is on your garden care checklist this month?", "Share your home maintenance questions."] };
    case "builders": case "creators": return { title: "What are you building?", prompt: "Share your idea, one recent milestone, and a challenge where feedback from fellow builders would help.", discussions: ["What did you ship or learn this week?", "Find a collaborator for your next idea."] };
    default: return { title: "Start a conversation", prompt: "Introduce yourself and share what brings you to this space.", discussions: ["What would you like to explore together?", "Share a question with this community."] };
  }
}
