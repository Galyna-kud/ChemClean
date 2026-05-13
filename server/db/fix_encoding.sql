-- Виправлення кодування даних. Запустити один раз.
SET client_encoding = 'UTF8';

-- Видаляємо зіпсовані дані (порядок важливий через foreign keys)
TRUNCATE order_items, payments, orders, clients, chemicals,
         services, service_categories, employees, roles, order_statuses
RESTART IDENTITY CASCADE;

-- Категорії послуг
INSERT INTO service_categories(name) VALUES
  ('Верхній одяг'),('Повсякденний одяг'),('Текстиль'),('Шкіра та замша'),('Взуття');

-- Статуси замовлень
INSERT INTO order_statuses(status_id,name,color,bg_color) VALUES
  (1,'Прийнято','#5865f2','#eef0fd'),
  (2,'В обробці','#e67e22','#fef3e2'),
  (3,'Готове','#27ae60','#e8f8ee'),
  (4,'Видано','#7f8c8d','#f0f2f3');

-- Послуги
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
  (4,'Чистка шкіряної куртки',650,'шт'),
  (4,'Чистка сумки',420,'шт'),
  (5,'Чистка кросівок',250,'пара'),
  (5,'Чистка шкіряного взуття',320,'пара');

-- Ролі
INSERT INTO roles(name,can_admin) VALUES
  ('Адміністратор',TRUE),('Приймальник',FALSE),('Технолог',FALSE),('Бухгалтер',FALSE);

-- Співробітники (пароль: password123)
INSERT INTO employees(full_name,role_id,login,password_hash,phone) VALUES
  ('Наталія Коваль',1,'admin','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380671110001'),
  ('Коваленко Оксана',2,'kovalenko','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380672220002'),
  ('Мельник Тарас',3,'melnyk','$2a$10$y9GGx5E631JujzfYmPlsN.dRJ9ETndNPCqQC/MxdB3QEn7fcoFC9u','+380673330003');

-- Клієнти
INSERT INTO clients(full_name,phone,email,address,loyalty_points) VALUES
  ('Іваненко Марія Олексіївна','+380671234567','ivanen@gmail.com','вул. Франка, 12, кв. 5',120),
  ('Петренко Василь Михайлович','+380679876543','petrenko@ukr.net','вул. Шевченка, 45',45),
  ('Сидоренко Наталія Вікторівна','+380665554433','nataliya@gmail.com','пр. Свободи, 8, кв. 22',300),
  ('Кравченко Іван Степанович','+380633332211','','вул. Героїв, 3',0);

-- Хімікати
INSERT INTO chemicals(name,quantity,unit,min_quantity) VALUES
  ('Перхлоретилен',1.8,'л',5),
  ('Уайт-спірит',14,'л',3),
  ('Плямовивідник',0.9,'кг',1),
  ('Кондиціонер',6,'л',2);
