-- Standalone visitor feedback, submitted from the visitor portal's Feedback page
-- (not tied to the check-out survey). A row may reference the visitor/location/
-- organization it came from, but all of those are nullable so general feedback
-- still lands, and the row survives if the referenced visitor is later pruned —
-- hence no foreign-key constraints. Scoping to a receptionist's institution is
-- done in application code via organization_id + location_id.
CREATE TABLE IF NOT EXISTS feedback (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NULL,
  location_id VARCHAR(64) NULL,
  visitor_id VARCHAR(64) NULL,
  name VARCHAR(255) NULL,
  rating TINYINT NULL,
  comment TEXT NULL,
  created_at DATETIME(3) NOT NULL
);
