CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  contact_email VARCHAR(255) NULL,
  contact_phone VARCHAR(64) NULL,
  address TEXT NULL,
  logo_url TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_by VARCHAR(64) NULL,
  created_at DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS locations (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL,
  name VARCHAR(255) NOT NULL,
  address TEXT NULL,
  floor_count INT NOT NULL DEFAULT 1,
  description TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  qr_code_token VARCHAR(255) NOT NULL,
  receptionist_ids JSON NULL,
  created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_locations_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL,
  organization_id VARCHAR(64) NULL,
  location_id VARCHAR(64) NULL,
  permissions JSON NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  last_login DATETIME(3) NULL,
  created_by VARCHAR(64) NULL,
  CONSTRAINT fk_users_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_users_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS visitors (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  id_number VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  organization_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  checkin_time DATETIME(3) NOT NULL,
  checkout_time DATETIME(3) NULL,
  status VARCHAR(32) NOT NULL,
  destination_text TEXT NULL,
  destination_node_id VARCHAR(64) NULL,
  route_node_ids JSON NULL,
  route_steps JSON NULL,
  current_node_id VARCHAR(64) NULL,
  last_position_update_at DATETIME(3) NULL,
  source VARCHAR(32) NULL,
  host_name VARCHAR(255) NULL,
  language VARCHAR(16) NULL,
  duration_min INT NULL,
  arrived_at DATETIME(3) NULL,
  department_notified_at DATETIME(3) NULL,
  department_notification_by VARCHAR(64) NULL,
  survey JSON NULL,
  CONSTRAINT fk_visitors_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_visitors_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS visitor_positions (
  id VARCHAR(64) PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  zone_id VARCHAR(64) NULL,
  node_id VARCHAR(64) NULL,
  x DECIMAL(10,2) NULL,
  y DECIMAL(10,2) NULL,
  timestamp DATETIME(3) NOT NULL,
  source VARCHAR(32) NULL,
  CONSTRAINT fk_visitor_positions_visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id)
);

CREATE TABLE IF NOT EXISTS map_nodes (
  id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  aliases JSON NULL,
  type VARCHAR(32) NOT NULL,
  zone VARCHAR(32) NOT NULL,
  x DECIMAL(10,2) NOT NULL,
  y DECIMAL(10,2) NOT NULL,
  floor INT NOT NULL DEFAULT 1,
  PRIMARY KEY (location_id, id),
  CONSTRAINT fk_map_nodes_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS map_edges (
  id VARCHAR(64) PRIMARY KEY,
  location_id VARCHAR(64) NOT NULL,
  from_node_id VARCHAR(64) NOT NULL,
  to_node_id VARCHAR(64) NOT NULL,
  distance_m DECIMAL(10,2) NOT NULL,
  direction VARCHAR(32) NULL,
  direction_hint TEXT NULL,
  is_accessible TINYINT(1) NOT NULL DEFAULT 1,
  CONSTRAINT fk_map_edges_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS alerts (
  id VARCHAR(64) PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  type VARCHAR(64) NOT NULL,
  zone_id VARCHAR(64) NULL,
  severity VARCHAR(32) NOT NULL,
  message TEXT NULL,
  triggered_at DATETIME(3) NOT NULL,
  acknowledged_by VARCHAR(64) NULL,
  acknowledged_at DATETIME(3) NULL,
  resolved_at DATETIME(3) NULL,
  rule_key VARCHAR(255) NULL,
  CONSTRAINT fk_alerts_visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id)
);

CREATE TABLE IF NOT EXISTS chatbot_faq (
  id VARCHAR(64) PRIMARY KEY,
  organization_id VARCHAR(64) NULL,
  language VARCHAR(16) NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords JSON NULL,
  hit_count INT NOT NULL DEFAULT 0,
  created_by VARCHAR(64) NULL,
  CONSTRAINT fk_chatbot_faq_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

CREATE TABLE IF NOT EXISTS audit_log (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NULL,
  actor_name VARCHAR(255) NULL,
  action_type VARCHAR(64) NOT NULL,
  target_type VARCHAR(64) NOT NULL,
  target_id VARCHAR(64) NULL,
  details TEXT NULL,
  ip_address VARCHAR(64) NULL,
  timestamp DATETIME(3) NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  date DATE NOT NULL,
  organization_id VARCHAR(64) NOT NULL,
  location_id VARCHAR(64) NOT NULL,
  total_visitors INT NOT NULL DEFAULT 0,
  avg_duration_min INT NOT NULL DEFAULT 0,
  peak_hour VARCHAR(16) NULL,
  top_destination VARCHAR(255) NULL,
  alerts_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (date, organization_id, location_id),
  CONSTRAINT fk_analytics_organization FOREIGN KEY (organization_id) REFERENCES organizations(id),
  CONSTRAINT fk_analytics_location FOREIGN KEY (location_id) REFERENCES locations(id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id VARCHAR(64) PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(64) NULL,
  message TEXT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  created_by VARCHAR(64) NULL,
  CONSTRAINT fk_notifications_visitor FOREIGN KEY (visitor_id) REFERENCES visitors(id)
);
