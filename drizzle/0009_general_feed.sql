-- Provision the canonical feed destination without changing existing space policies.
INSERT INTO spaces (id, slug, name, tagline, description, icon, privacy, is_featured)
VALUES ('space-welcome', 'welcome', 'General / Welcome', 'Your community starts here.',
  'Introduce yourself, meet your neighbours, and share with the community.', 'Users', 'public', 1)
ON CONFLICT DO NOTHING;
