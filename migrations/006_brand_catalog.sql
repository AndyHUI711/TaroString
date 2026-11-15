-- Brand suggestions and string-model performance are shared across the site.
CREATE TABLE IF NOT EXISTS brands (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL CHECK (kind IN ('racket', 'string')),
  name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 40),
  UNIQUE (kind, name)
);

CREATE TABLE IF NOT EXISTS string_models (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL COLLATE NOCASE CHECK (length(trim(name)) BETWEEN 1 AND 80),
  power INTEGER CHECK (power IS NULL OR (typeof(power) = 'integer' AND power BETWEEN 1 AND 5)),
  control INTEGER CHECK (control IS NULL OR (typeof(control) = 'integer' AND control BETWEEN 1 AND 5)),
  spin INTEGER CHECK (spin IS NULL OR (typeof(spin) = 'integer' AND spin BETWEEN 1 AND 5)),
  durability INTEGER CHECK (durability IS NULL OR (typeof(durability) = 'integer' AND durability BETWEEN 1 AND 5)),
  UNIQUE (brand_id, name)
);

INSERT OR IGNORE INTO brands (kind, name) VALUES
  ('racket', 'Yonex'), ('racket', 'Babolat'), ('racket', 'Wilson'),
  ('racket', 'HEAD'), ('racket', 'Prince'), ('racket', 'Tecnifibre'),
  ('racket', 'Dunlop'), ('racket', 'Solinco'), ('racket', 'Volkl'),
  ('racket', 'Diadem'), ('racket', 'Angell'), ('racket', 'Slazenger'),
  ('racket', 'ProKennex'), ('racket', 'Pacific'), ('racket', 'Fischer'),
  ('racket', 'Kawasaki'), ('racket', 'Victor'), ('racket', 'Li-Ning'),
  ('string', 'Luxilon'), ('string', 'Babolat'), ('string', 'Tecnifibre'),
  ('string', 'Solinco'), ('string', 'Wilson'), ('string', 'HEAD'),
  ('string', 'Yonex'), ('string', 'Taan'), ('string', 'Prince'),
  ('string', 'Kirschbaum'), ('string', 'Signum Pro'), ('string', 'Volkl'),
  ('string', 'Gosen'), ('string', 'Gamma'), ('string', 'Ashaway'),
  ('string', 'MSV'), ('string', 'IsoSpeed'), ('string', 'Toalson'),
  ('string', 'Polyfibre'), ('string', 'Pro''s Pro'), ('string', 'Oehms'),
  ('string', 'Alpha'), ('string', 'L-Tec'), ('string', 'Mayami'),
  ('string', 'Toroline'), ('string', 'Ytex');

INSERT OR IGNORE INTO brands (kind, name)
SELECT 'racket', trim(racket_brand) FROM rackets
WHERE length(trim(racket_brand)) BETWEEN 1 AND 40;
INSERT OR IGNORE INTO brands (kind, name)
SELECT 'string', trim(main_brand) FROM string_jobs
WHERE length(trim(main_brand)) BETWEEN 1 AND 40;
INSERT OR IGNORE INTO brands (kind, name)
SELECT 'string', trim(cross_brand) FROM string_jobs
WHERE length(trim(cross_brand)) BETWEEN 1 AND 40;
