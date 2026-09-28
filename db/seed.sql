INSERT INTO
  users (id, name, role, skills, avatar_url)
VALUES
  (
    '3f1c6b7e-8a2d-4c19-9f04-7b6d5e2a1c30',
    'Amina Diallo',
    'Product designer',
    '["Figma","User research","Design systems"]',
    NULL
  ),
  (
    '8c4a2d19-5e7b-4f30-a1c8-2d9b6f3e7a41',
    'Kwame Mensah',
    'Backend engineer',
    '["TypeScript","D1","API design"]',
    NULL
  ),
  (
    'd7e3f9a0-1b6c-4d28-8e5a-9c0f4b7d2e63',
    'Zanele Ndlovu',
    'Community manager',
    '["Events","Moderation","Partnerships"]',
    NULL
  ),
  (
    '5a9b1c4d-7e2f-4830-b6d9-3f8a1c5e9b02',
    'Tunde Balogun',
    'Founder',
    '["Fintech","Fundraising","Go-to-market"]',
    NULL
  )
ON CONFLICT (id) DO NOTHING;
