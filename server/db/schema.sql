-- ChemClean Pro — Schema v3
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS service_categories (
  category_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  service_id  SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES service_categories ON DELETE RESTRICT,
  name        VARCHAR(200) NOT NULL,
  base_price  DECIMAL(10,2) NOT NULL CHECK (base_price > 0),
  unit        VARCHAR(20) NOT NULL DEFAULT 'шт',
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS roles (
  role_id   SERIAL PRIMARY KEY,
  name      VARCHAR(50) NOT NULL UNIQUE,
  can_admin BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS employees (
  employee_id   SERIAL PRIMARY KEY,
  full_name     VARCHAR(150) NOT NULL,
  role_id       INTEGER NOT NULL REFERENCES roles ON DELETE RESTRICT,
  login         VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(200) NOT NULL,
  phone         VARCHAR(20),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clients (
  client_id      SERIAL PRIMARY KEY,
  full_name      VARCHAR(150) NOT NULL,
  phone          VARCHAR(20) NOT NULL UNIQUE,
  email          VARCHAR(100),
  address        TEXT,
  loyalty_points INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_statuses (
  status_id INTEGER PRIMARY KEY,
  name      VARCHAR(50) NOT NULL,
  color     VARCHAR(10) NOT NULL,
  bg_color  VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  order_id       SERIAL PRIMARY KEY,
  order_number   VARCHAR(20) NOT NULL UNIQUE,
  client_id      INTEGER NOT NULL REFERENCES clients ON DELETE RESTRICT,
  employee_id    INTEGER NOT NULL REFERENCES employees ON DELETE RESTRICT,
  status_id      INTEGER NOT NULL REFERENCES order_statuses,
  date_received  TIMESTAMP NOT NULL DEFAULT NOW(),
  date_promised  DATE NOT NULL,
  date_completed TIMESTAMP,
  total_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_pct   DECIMAL(5,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  item_id     SERIAL PRIMARY KEY,
  order_id    INTEGER NOT NULL REFERENCES orders ON DELETE CASCADE,
  service_id  INTEGER NOT NULL REFERENCES services ON DELETE RESTRICT,
  description VARCHAR(300) NOT NULL,
  qty         DECIMAL(8,2) NOT NULL DEFAULT 1,
  unit_price  DECIMAL(10,2) NOT NULL DEFAULT 0,
  subtotal    DECIMAL(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS payments (
  payment_id     SERIAL PRIMARY KEY,
  order_id       INTEGER NOT NULL UNIQUE REFERENCES orders ON DELETE RESTRICT,
  amount         DECIMAL(10,2) NOT NULL,
  payment_date   TIMESTAMP NOT NULL DEFAULT NOW(),
  payment_method VARCHAR(30) NOT NULL DEFAULT 'cash',
  receipt_number VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS chemicals (
  chemical_id  SERIAL PRIMARY KEY,
  name         VARCHAR(150) NOT NULL,
  quantity     DECIMAL(10,3) NOT NULL DEFAULT 0,
  unit         VARCHAR(20) NOT NULL DEFAULT 'л',
  min_quantity DECIMAL(10,3) NOT NULL DEFAULT 2,
  updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_client ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status_id);
CREATE INDEX IF NOT EXISTS idx_orders_date   ON orders(date_received);
CREATE INDEX IF NOT EXISTS idx_items_order   ON order_items(order_id);

-- ═══ ДАНІ ═══
INSERT INTO service_categories(name) VALUES
  ('Верхній одяг'),('Повсякденний одяг'),('Текстиль'),('Шкіра та замша'),('Взуття')
ON CONFLICT DO NOTHING;

INSERT INTO order_statuses(status_id,name,color,bg_color) VALUES
  (1,'Прийнято','#5865f2','#eef0fd'),
  (2,'В обробці','#e67e22','#fef3e2'),
  (3,'Готове','#27ae60','#e8f8ee'),
  (4,'Видано','#7f8c8d','#f0f2f3')
ON CONFLICT DO NOTHING;

INSERT INTO services(category_id,name,base_price,unit) VALUES
  (1,'Хімчистка куртки',380,'шт'),
  (1,'Хімчистка пальта',520,'шт'),
  (1,'Хімчистка шуби',1200,'шт'),
  (2,'Хімчистка костюма',450,'шт'),
  (2,'Хімчистка сукні',320,'шт'),
  (2,'Хімчистка джинсів',180,'шт'),
  (2,'Хімчистка сорочки',120,'шт'),
  (3,'Чистка ковдри',280,'шт'),
  (3,'Чистка штор (1 кв.м)',95,'кв.м'),
  (3,'Чистка килима (1 кв.м)',75,'кв.м'),
  (4,'Чистка шкiряної куртки',650,'шт'),
  (4,'Чистка сумки',420,'шт'),
  (5,'Чистка кросiвок',250,'пара'),
  (5,'Чистка шкiряного взуття',320,'пара')
ON CONFLICT DO NOTHING;

INSERT INTO roles(name,can_admin) VALUES
  ('Адмiнiстратор',TRUE),('Приймальник',FALSE),('Технолог',FALSE),('Бухгалтер',FALSE)
ON CONFLICT DO NOTHING;

-- ПАРОЛЬ ДЛЯ ВСІХ: password123
INSERT INTO employees(full_name,role_id,login,password_hash,phone) VALUES
  ('Дорошенко А.В.',1,'admin','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380671110001'),
  ('Коваленко Оксана',2,'kovalenko','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380672220002'),
  ('Мельник Тарас',3,'melnyk','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380673330003'),
  ('Бондаренко Лариса',4,'bondarenko','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380674440004')
ON CONFLICT DO NOTHING;

INSERT INTO clients(full_name,phone,email,address,loyalty_points) VALUES
  ('Iваненко Марiя Олексiiвна','+380671234567','ivanen@gmail.com','вул. Франка, 12, кв. 5',120),
  ('Петренко Василь Михайлович','+380679876543','petrenko@ukr.net','вул. Шевченка, 45',45),
  ('Сидоренко Наталiя Вiкторiвна','+380665554433','nataliya@gmail.com','пр. Свободи, 8, кв. 22',300),
  ('Кравченко Iван Степанович','+380633332211','','вул. Героiв, 3',0)
ON CONFLICT DO NOTHING;

INSERT INTO chemicals(name,quantity,unit,min_quantity) VALUES
  ('Перхлоретилен',1.8,'л',5),
  ('Уайт-спiрит',14,'л',3),
  ('Плямовивiдник',0.9,'кг',1),
  ('Кондицiонер',6,'л',2)
ON CONFLICT DO NOTHING;
