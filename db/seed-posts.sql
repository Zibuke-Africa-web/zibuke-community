INSERT INTO
  posts (id, user_id, group_id, content, created_at)
VALUES
  (
    'e4b8d2f6-1a93-4c07-8b5e-6f2d9a4c7e18',
    '3f1c6b7e-8a2d-4c19-9f04-7b6d5e2a1c30',
    'a1d4f8c2-6b3e-4a91-8f27-5c0e9b7d3a14',
    'Reworked the onboarding flow after yesterday''s demo. The empty states were doing more work than the copy, and nobody had noticed.',
    unixepoch('now', '-25 minutes')
  ),
  (
    'f2c7e9a4-8d15-4b63-9f28-3a7c1e5d8b94',
    '8c4a2d19-5e7b-4f30-a1c8-2d9b6f3e7a41',
    'b7e2c5a9-3f81-4d6b-9a40-1e8d2c6f7b35',
    'Reads from D1 are faster than I expected. The directory query comes back in single-digit milliseconds locally with no cache in front of it.',
    unixepoch('now', '-3 hours')
  ),
  (
    'a8d1f4b7-2c96-4e30-8a75-9b3e6c2f1d58',
    'd7e3f9a0-1b6c-4d28-8e5a-9c0f4b7d2e63',
    NULL,
    'Two spots left for Thursday''s community call. Bring one problem you are actually stuck on, not a status update.',
    unixepoch('now', '-1 day')
  ),
  (
    'd6f2a8c1-7b43-4d95-8e16-2c9f4a7b3e85',
    '5a9b1c4d-7e2f-4830-b6d9-3f8a1c5e9b02',
    'c9f3a1b8-4d27-4e58-b3c6-8a1f5e9d2c07',
    'Third pricing conversation this week where the objection was not the number. It was the absence of a way out. Annual plans need an exit.',
    unixepoch('now', '-4 days')
  )
ON CONFLICT (id) DO NOTHING;
