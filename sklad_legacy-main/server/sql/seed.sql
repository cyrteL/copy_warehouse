-- Seed roles and permissions
INSERT IGNORE INTO roles (id, name) VALUES
 (1,'admin'),(2,'manager'),(3,'operator'),(4,'viewer');

INSERT IGNORE INTO permissions (id, name) VALUES
 (1,'read'),(2,'write'),(3,'delete'),(4,'admin');

INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES
 (1,1),(1,2),(1,3),(1,4), -- admin: all
 (2,1),(2,2),             -- manager: read, write
 (3,1),                   -- operator: read
 (4,1);                   -- viewer: read

-- Users (CHANGE THESE PASSWORDS IN PRODUCTION!)
-- Default passwords: admin123, manager123, operator123, viewer123
-- Use bcrypt or similar for production hashing
INSERT INTO users (id, username, password_hash, name, email, department, position) VALUES
 (1,'admin','admin123','Администратор','admin@company.com','IT','Системный администратор'),
 (2,'manager','manager123','Менеджер склада','manager@company.com','Склад','Менеджер склада'),
 (3,'operator','operator123','Оператор','operator@company.com','Склад','Оператор склада'),
 (4,'viewer','viewer123','Наблюдатель','viewer@company.com','Бухгалтерия','Бухгалтер')
ON DUPLICATE KEY UPDATE name=VALUES(name);

INSERT IGNORE INTO user_roles (user_id, role_id) VALUES
 (1,1), (2,2), (3,3), (4,4);

-- Categories
INSERT INTO categories (id, name, description, icon, color, active) VALUES
 (1,'Электроника','Техника и гаджеты','fas fa-laptop','#2c5aa0',1),
 (2,'Инструменты','Строительные и слесарные инструменты','fas fa-tools','#1a7f37',1),
 (3,'Офис','Канцелярия и офисные товары','fas fa-briefcase','#8a2be2',1)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- Items
INSERT INTO items (name, category_id, price, quantity, description, barcode, min_quantity, location, supplier) VALUES
 ('Ноутбук Lenovo', 1, 65000, 10, '15.6" Ryzen 5', 'LN-12345', 2, 'Стеллаж A1', 'Lenovo'),
 ('Шуруповерт Bosch', 2, 8500, 25, 'Аккумуляторный 18В', 'BS-98765', 5, 'Стеллаж B2', 'Bosch'),
 ('Бумага A4', 3, 350, 200, 'Пачка 500 листов', 'A4-11111', 50, 'Стеллаж C3', 'Svetocopy');

-- Sample operations (today)
INSERT INTO operations (type, item_id, quantity, employee_id, status, notes, supplier)
VALUES ('incoming', 1, 5, 1, 'completed', 'Поступление партии', 'Lenovo');

