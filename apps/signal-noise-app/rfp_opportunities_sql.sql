CREATE TABLE IF NOT EXISTS rfp_opportunities (
  id SERIAL PRIMARY KEY,
  organization TEXT NOT NULL,
  src_link TEXT,
  title TEXT,
  confidence FLOAT,
  urgency TEXT,
  fit_score INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO rfp_opportunities (organization, src_link, title, confidence, urgency, fit_score)
VALUES ('Hanshin Tigers', 'https://www.tendersontime.com/tenders-details/renovation-work-asahi-sports-center-baseball-stadium-2025-regional-measures-power-supply-location-a-77b7870/', 'Japan Govt Tender for Renovation Work for Asahi Sports Center Baseball Stadium', 0.2, 'low', 25);