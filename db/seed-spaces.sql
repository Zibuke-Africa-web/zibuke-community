-- Run explicitly after the Spaces migration. Safe to repeat; preserves edits.
INSERT INTO spaces (id, slug, name, tagline, description, icon, privacy, is_featured)
VALUES
  ('space-welcome', 'welcome', 'General / Welcome', 'Your community starts here.', 'Introduce yourself, meet your neighbours, and find your feet in the Zibuke community.', 'Users', 'public', 1),
  ('space-business', 'business', 'Local Business & Hustles', 'Build local. Grow together.', 'Connect with local entrepreneurs, exchange ideas, and support the businesses and hustles around you.', 'BriefcaseBusiness', 'public', 0),
  ('space-home-and-garden', 'home-and-garden', 'Home & Garden Care', 'A little care goes a long way.', 'A Zibuke OnCall partnership space for home maintenance, garden care, and practical advice from your community.', 'House', 'public', 0),
  ('space-creators', 'creators', 'Founders & Creators', 'Turn your next idea into something real.', 'A members-only space for founders and creators to share progress, exchange feedback, and find collaborators.', 'Lightbulb', 'members_only', 0)
ON CONFLICT (slug) DO NOTHING;
