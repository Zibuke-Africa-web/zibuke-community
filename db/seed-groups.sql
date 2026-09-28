INSERT INTO
  groups (id, name, description)
VALUES
  (
    'a1d4f8c2-6b3e-4a91-8f27-5c0e9b7d3a14',
    'Secunda AI Creators',
    'Builders shipping AI products from Secunda. Weekly demos, model notes, and honest feedback on what is actually working.'
  ),
  (
    'b7e2c5a9-3f81-4d6b-9a40-1e8d2c6f7b35',
    'Web Dev Hub',
    'Frontend and backend talk for the web: performance, accessibility, and the tooling everyone keeps arguing about.'
  ),
  (
    'c9f3a1b8-4d27-4e58-b3c6-8a1f5e9d2c07',
    'Startup Founders',
    'Early-stage founders comparing notes on customers, pricing, and fundraising. No pitch decks, just problems.'
  )
ON CONFLICT (id) DO NOTHING;
