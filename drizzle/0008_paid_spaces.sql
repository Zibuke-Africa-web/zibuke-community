-- Canonical membership prices are server-owned; checkout never takes a price from a browser.
INSERT INTO spaces (id,slug,name,description,icon,privacy,is_paywalled,currency,monthly_price_cents,annual_price_cents)
VALUES
 ('paid-greenspace-hub','greenspace-hub','GreenSpace Hub','Practical South African garden guidance, plant diagnostics and seasonal workshops.','Leaf','public',1,'ZAR',5000,30000),
 ('paid-builders-lab','builders-lab','Community Builders Lab','Founder teardowns, working sessions and a focused community of builders.','Lightbulb','public',1,'USD',12000,70000),
 ('paid-bulletproof-venture','bulletproof-venture','Bulletproof Venture Collective','Build resilient ventures through live sessions and peer accountability.','BriefcaseBusiness','public',1,'USD',4900,25000)
ON CONFLICT(slug) DO UPDATE SET is_paywalled=1,currency=excluded.currency,
 monthly_price_cents=excluded.monthly_price_cents,annual_price_cents=excluded.annual_price_cents;
