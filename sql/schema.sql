-- VisionOne Portal — shema MySQL/MariaDB
-- Uvoz v phpMyAdmin: najprej izberite obstoječo bazo (Neoserv jo ustvari vnaprej),
-- nato zavihek Uvoz / Import in to datoteko. Ne ustvarja baze in ne vsebuje demo podatkov.
-- Znakovni nabor: utf8mb4. Tujih ključev namerno ni (brisanje je v aplikaciji).
-- Po uvozu ob prvi prijavi nastane uporabnik admin / admin z obvezno menjavo gesla,
-- če tabela users še nima vrstic. Demo podatki: npm run db:seed:demo

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id INT NOT NULL AUTO_INCREMENT,
  username VARCHAR(191) NOT NULL,
  name VARCHAR(255) NULL,
  hash VARCHAR(255) NOT NULL,
  role VARCHAR(32) NOT NULL DEFAULT 'admin',
  must_change TINYINT NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_key (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token VARCHAR(128) NOT NULL,
  user_id INT NOT NULL,
  expires VARCHAR(40) NOT NULL,
  PRIMARY KEY (token),
  KEY sessions_user_id_idx (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS settings (
  k VARCHAR(191) NOT NULL,
  v LONGTEXT NULL,
  PRIMARY KEY (k)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS counters (
  name VARCHAR(191) NOT NULL,
  n INT NOT NULL DEFAULT 0,
  PRIMARY KEY (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit (
  id INT NOT NULL AUTO_INCREMENT,
  at VARCHAR(40) NULL,
  user VARCHAR(191) NULL,
  action VARCHAR(64) NULL,
  ref VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY audit_at_idx (at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  id INT NOT NULL AUTO_INCREMENT,
  ip VARCHAR(64) NOT NULL,
  at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  KEY login_attempts_ip_at_idx (ip, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS customers (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  kind VARCHAR(32) NULL,
  name VARCHAR(255) NULL,
  company VARCHAR(255) NULL,
  vat_id VARCHAR(64) NULL,
  vat_payer INT NULL,
  reg_no VARCHAR(64) NULL,
  address TEXT NULL,
  post VARCHAR(32) NULL,
  city VARCHAR(128) NULL,
  country VARCHAR(128) NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  contacts LONGTEXT NULL,
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  notes LONGTEXT NULL,
  tags VARCHAR(255) NULL,
  payment_days INT NULL,
  PRIMARY KEY (id),
  KEY customers_name_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sites (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  name VARCHAR(255) NULL,
  address TEXT NULL,
  post VARCHAR(32) NULL,
  city VARCHAR(128) NULL,
  lat DOUBLE NULL,
  lng DOUBLE NULL,
  access_info LONGTEXT NULL,
  alarm_code LONGTEXT NULL,
  wifi LONGTEXT NULL,
  internet TEXT NULL,
  notes LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY sites_customer_id_idx (customer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS equipment (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  type VARCHAR(32) NULL,
  name VARCHAR(255) NULL,
  brand VARCHAR(128) NULL,
  model VARCHAR(128) NULL,
  serial VARCHAR(128) NULL,
  ip VARCHAR(64) NULL,
  mac VARCHAR(64) NULL,
  vlan VARCHAR(32) NULL,
  port VARCHAR(64) NULL,
  firmware VARCHAR(128) NULL,
  username VARCHAR(128) NULL,
  password LONGTEXT NULL,
  location VARCHAR(255) NULL,
  install_date VARCHAR(40) NULL,
  warranty_until VARCHAR(40) NULL,
  status VARCHAR(32) NULL,
  product_id INT NULL,
  notes LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY equipment_customer_id_idx (customer_id),
  KEY equipment_site_id_idx (site_id),
  KEY equipment_ip_idx (ip)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS networks (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  name VARCHAR(255) NULL,
  vlan VARCHAR(32) NULL,
  subnet VARCHAR(64) NULL,
  gateway VARCHAR(64) NULL,
  dns VARCHAR(255) NULL,
  dhcp_range VARCHAR(128) NULL,
  public_ip VARCHAR(64) NULL,
  ddns VARCHAR(255) NULL,
  port_forwards LONGTEXT NULL,
  notes LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY networks_customer_id_idx (customer_id),
  KEY networks_site_id_idx (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documents (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  workorder_id INT NULL,
  kind VARCHAR(32) NULL,
  title VARCHAR(255) NULL,
  filename VARCHAR(255) NULL,
  mime VARCHAR(128) NULL,
  size INT NULL,
  path TEXT NULL,
  PRIMARY KEY (id),
  KEY documents_customer_id_idx (customer_id),
  KEY documents_site_id_idx (site_id),
  KEY documents_workorder_id_idx (workorder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS diagrams (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  name VARCHAR(255) NULL,
  background_id INT NULL,
  items LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY diagrams_customer_id_idx (customer_id),
  KEY diagrams_site_id_idx (site_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workorders (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  contract_id INT NULL,
  title VARCHAR(255) NULL,
  type VARCHAR(32) NULL,
  status VARCHAR(32) NULL,
  priority VARCHAR(32) NULL,
  start VARCHAR(40) NULL,
  end VARCHAR(40) NULL,
  technician VARCHAR(255) NULL,
  description LONGTEXT NULL,
  report LONGTEXT NULL,
  checklist LONGTEXT NULL,
  time_entries LONGTEXT NULL,
  materials LONGTEXT NULL,
  signature LONGTEXT NULL,
  signed_by VARCHAR(255) NULL,
  signed_at VARCHAR(40) NULL,
  PRIMARY KEY (id),
  KEY workorders_customer_id_idx (customer_id),
  KEY workorders_site_id_idx (site_id),
  KEY workorders_contract_id_idx (contract_id),
  KEY workorders_start_idx (start)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  kind VARCHAR(32) NULL,
  sku VARCHAR(64) NULL,
  name VARCHAR(255) NULL,
  brand VARCHAR(128) NULL,
  category VARCHAR(128) NULL,
  unit VARCHAR(32) NULL,
  price DOUBLE NULL,
  cost DOUBLE NULL,
  vat_rate DOUBLE NULL,
  stock DOUBLE NULL,
  min_stock DOUBLE NULL,
  location VARCHAR(255) NULL,
  notes LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY products_sku_idx (sku),
  KEY products_name_idx (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_moves (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  product_id INT NULL,
  qty DOUBLE NULL,
  reason VARCHAR(255) NULL,
  ref VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY stock_moves_product_id_idx (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quotes (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  number VARCHAR(64) NULL,
  title VARCHAR(255) NULL,
  date VARCHAR(40) NULL,
  valid_until VARCHAR(40) NULL,
  status VARCHAR(32) NULL,
  `lines` LONGTEXT NULL,
  discount_pct DOUBLE NULL,
  notes LONGTEXT NULL,
  net DOUBLE NULL,
  vat DOUBLE NULL,
  total DOUBLE NULL,
  invoice_id INT NULL,
  PRIMARY KEY (id),
  KEY quotes_customer_id_idx (customer_id),
  KEY quotes_site_id_idx (site_id),
  KEY quotes_number_idx (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS invoices (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  quote_id INT NULL,
  number VARCHAR(64) NULL,
  title VARCHAR(255) NULL,
  date VARCHAR(40) NULL,
  service_date VARCHAR(40) NULL,
  due_date VARCHAR(40) NULL,
  status VARCHAR(32) NULL,
  `lines` LONGTEXT NULL,
  discount_pct DOUBLE NULL,
  notes LONGTEXT NULL,
  net DOUBLE NULL,
  vat DOUBLE NULL,
  total DOUBLE NULL,
  paid_amount DOUBLE NULL,
  paid_date VARCHAR(40) NULL,
  payment_method VARCHAR(32) NULL,
  reference VARCHAR(64) NULL,
  issued_at VARCHAR(40) NULL,
  PRIMARY KEY (id),
  KEY invoices_customer_id_idx (customer_id),
  KEY invoices_site_id_idx (site_id),
  KEY invoices_quote_id_idx (quote_id),
  KEY invoices_number_idx (number),
  KEY invoices_status_idx (status),
  KEY invoices_due_date_idx (due_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contracts (
  id INT NOT NULL AUTO_INCREMENT,
  created_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL,
  customer_id INT NULL,
  site_id INT NULL,
  title VARCHAR(255) NULL,
  start_date VARCHAR(40) NULL,
  end_date VARCHAR(40) NULL,
  interval_months INT NULL,
  next_date VARCHAR(40) NULL,
  price DOUBLE NULL,
  sla VARCHAR(255) NULL,
  active INT NULL,
  checklist LONGTEXT NULL,
  notes LONGTEXT NULL,
  PRIMARY KEY (id),
  KEY contracts_customer_id_idx (customer_id),
  KEY contracts_site_id_idx (site_id),
  KEY contracts_next_date_idx (next_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
