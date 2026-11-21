-- =====================================================================
-- BATLOUNG FARM DISTRIBUTION SYSTEM
-- Database Script for Maseru, Lesotho
-- Compatible with MySQL Workbench 8.0+
-- Database: batloung_farm_db
-- =====================================================================

DROP DATABASE IF EXISTS batloung_farm_db;
CREATE DATABASE batloung_farm_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE batloung_farm_db;

-- 1. Suppliers Table
CREATE TABLE suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    business_name VARCHAR(150) NOT NULL,
    contact_person VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    province ENUM('Gauteng', 'Free State', 'KwaZulu-Natal', 'Western Cape', 'Eastern Cape', 'Limpopo', 'Mpumalanga', 'North West') NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Fruits Table
CREATE TABLE fruits (
    fruit_id INT AUTO_INCREMENT PRIMARY KEY,
    fruit_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Fruit Pricing by Packaging Size
CREATE TABLE fruit_pricing (
    pricing_id INT AUTO_INCREMENT PRIMARY KEY,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    selling_price DECIMAL(10,2) NOT NULL,
    cost_price DECIMAL(10,2) NOT NULL,
    UNIQUE KEY uq_fruit_packaging (fruit_id, packaging_size),
    FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 4. Stock Table (Tracks separate stock for small, medium, large)
CREATE TABLE stock (
    stock_id INT AUTO_INCREMENT PRIMARY KEY,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    available_quantity INT NOT NULL DEFAULT 0,
    reorder_level INT NOT NULL DEFAULT 15,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_stock_fruit_size (fruit_id, packaging_size),
    FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 5. Users Table (Admin and Vendor authentication)
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(120) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'vendor') NOT NULL DEFAULT 'vendor',
    full_name VARCHAR(120) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 6. Vendors Table (Integrated with location data in Maseru, Lesotho)
CREATE TABLE vendors (
    vendor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    vendor_name VARCHAR(120) NOT NULL,
    phone_number VARCHAR(30) NOT NULL UNIQUE,
    location VARCHAR(150) NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    registration_date DATE NOT NULL,
    outstanding_balance DECIMAL(12,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 7. Purchases Table
CREATE TABLE purchases (
    purchase_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    purchase_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    FOREIGN KEY (supplier_id) REFERENCES suppliers(supplier_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 8. Purchase Details Table
CREATE TABLE purchase_details (
    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    purchase_id INT NOT NULL,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    quantity INT NOT NULL,
    unit_cost DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (purchase_id) REFERENCES purchases(purchase_id) ON DELETE CASCADE,
    FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 9. Sales Table (With Live Order Tracking and Payment Management)
CREATE TABLE sales (
    sale_id INT AUTO_INCREMENT PRIMARY KEY,
    vendor_id INT NOT NULL,
    sale_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_status ENUM('pending', 'confirmed', 'processing', 'out_for_delivery', 'ready_for_collection', 'delivered', 'cancelled') NOT NULL DEFAULT 'pending',
    payment_status ENUM('PAID', 'PARTIALLY_PAID', 'UNPAID') NOT NULL DEFAULT 'UNPAID',
    payment_method ENUM('Cash', 'Mobile Money', 'Credit') NOT NULL DEFAULT 'Cash',
    amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    balance_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    delivery_type ENUM('delivery', 'collection') NOT NULL DEFAULT 'delivery',
    delivery_lat DECIMAL(10,7),
    delivery_lng DECIMAL(10,7),
    distance_km DECIMAL(6,2) DEFAULT 0.00,
    estimated_time_mins INT DEFAULT 0,
    batch_photo_url VARCHAR(500) DEFAULT NULL,
    batch_inspection_notes VARCHAR(255) DEFAULT NULL,
    notes TEXT,
    FOREIGN KEY (vendor_id) REFERENCES vendors(vendor_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 10. Sales Details Table
CREATE TABLE sales_details (
    sales_detail_id INT AUTO_INCREMENT PRIMARY KEY,
    sale_id INT NOT NULL,
    fruit_id INT NOT NULL,
    packaging_size ENUM('small', 'medium', 'large') NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    FOREIGN KEY (sale_id) REFERENCES sales(sale_id) ON DELETE CASCADE,
    FOREIGN KEY (fruit_id) REFERENCES fruits(fruit_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- =====================================================================
-- SEED SAMPLE DATA
-- =====================================================================

-- Default Users (Admin@123 and Vendor@123 hashed with bcrypt)
INSERT INTO users (email, password_hash, role, full_name) VALUES
('admin@batloung.farm', '$2b$10$fI73L3ZlX0jY1B2jV9hPpeJ3B5j8e4w9H7m5q8g2l1K3j9f7i5zfa', 'admin', 'Maseru Central Administrator'),
('lerato@vendor.ls', '$2b$10$fI73L3ZlX0jY1B2jV9hPpeJ3B5j8e4w9H7m5q8g2l1K3j9f7i5zfa', 'vendor', 'Lerato Moeti'),
('thabo@vendor.ls', '$2b$10$fI73L3ZlX0jY1B2jV9hPpeJ3B5j8e4w9H7m5q8g2l1K3j9f7i5zfa', 'vendor', 'Thabo Nkoane'),
('mpho@vendor.ls', '$2b$10$fI73L3ZlX0jY1B2jV9hPpeJ3B5j8e4w9H7m5q8g2l1K3j9f7i5zfa', 'vendor', 'Mpho Sekoati');

-- Vendors in Maseru, Lesotho
INSERT INTO vendors (user_id, vendor_name, phone_number, location, latitude, longitude, registration_date, outstanding_balance) VALUES
(2, 'Lerato Fresh Market', '+266 5890 1234', 'Kingsway Street, Maseru Central', -29.3138, 27.4842, '2026-01-15', 350.00),
(3, 'Thabo Street Produce', '+266 5922 4321', 'Maseru Mall Circle, Thetsane', -29.3411, 27.4816, '2026-02-01', 0.00),
(4, 'Sekoati Corner Stalls', '+266 6200 9876', 'Cathedral Area, Stadium Road', -29.3082, 27.4981, '2026-02-20', 120.00);

-- Suppliers from South African Provinces
INSERT INTO suppliers (business_name, contact_person, phone, province, address) VALUES
('Highveld Orchards', 'Johan Van Der Merwe', '+27 11 890 2231', 'Gauteng', '42 Farm Route, Boksburg'),
('Maluti Fruit Producers', 'Kobus Steyn', '+27 51 400 9811', 'Free State', '12 Wheatfield Road, Ficksburg'),
('Natal Citrus Estate', 'Sipho Zulu', '+27 31 202 8744', 'KwaZulu-Natal', 'Plot 88 Sugarbelt, Pietermaritzburg'),
('Cape Valley Farms', 'Andre Marais', '+27 21 880 1199', 'Western Cape', 'Robertson Valley, Stellenbosch'),
('Limpopo Sun Fruits', 'Tebogo Maleka', '+27 15 291 3344', 'Limpopo', 'Tzaneen Road, Polokwane');

-- 5 Prescribed Fruit Types
INSERT INTO fruits (fruit_name, description, status) VALUES
('Apples', 'Crisp South African Gala and Granny Smith apples', 'active'),
('Bananas', 'Sweet, sun-ripened Cavendish bananas', 'active'),
('Oranges', 'Juicy Valencia and Navel winter oranges', 'active'),
('Mangoes', 'Sweet Tommy Atkins and Kent seasonal mangoes', 'active'),
('Grapes', 'Sweet, seedless red and white table grapes', 'active');

-- Pricing by Packaging Size (Small, Medium, Large)
INSERT INTO fruit_pricing (fruit_id, packaging_size, cost_price, selling_price) VALUES
-- Apples
(1, 'small', 45.00, 65.00),
(1, 'medium', 80.00, 115.00),
(1, 'large', 140.00, 195.00),
-- Bananas
(2, 'small', 40.00, 58.00),
(2, 'medium', 75.00, 105.00),
(2, 'large', 130.00, 180.00),
-- Oranges
(3, 'small', 35.00, 52.00),
(3, 'medium', 65.00, 95.00),
(3, 'large', 115.00, 160.00),
-- Mangoes
(4, 'small', 55.00, 80.00),
(4, 'medium', 95.00, 140.00),
(4, 'large', 160.00, 230.00),
-- Grapes
(5, 'small', 50.00, 75.00),
(5, 'medium', 90.00, 130.00),
(5, 'large', 155.00, 220.00);

-- Initial Stock Levels (Separated by small, medium, and large packaging sizes)
INSERT INTO stock (fruit_id, packaging_size, available_quantity, reorder_level) VALUES
(1, 'small', 45, 15),
(1, 'medium', 32, 10),
(1, 'large', 20, 10),
(2, 'small', 60, 20),
(2, 'medium', 40, 15),
(2, 'large', 25, 10),
(3, 'small', 55, 15),
(3, 'medium', 35, 15),
(3, 'large', 18, 10),
(4, 'small', 30, 10),
(4, 'medium', 18, 10),
(4, 'large', 8, 10),
(5, 'small', 40, 15),
(5, 'medium', 22, 10),
(5, 'large', 12, 10);

-- Initial Recorded Purchases
INSERT INTO purchases (supplier_id, purchase_date, total_amount, notes) VALUES
(2, DATE_SUB(NOW(), INTERVAL 5 DAY), 5350.00, 'Free State seasonal apple and banana restock'),
(4, DATE_SUB(NOW(), INTERVAL 2 DAY), 6200.00, 'Western Cape bulk grape and orange restock');

INSERT INTO purchase_details (purchase_id, fruit_id, packaging_size, quantity, unit_cost, subtotal) VALUES
(1, 1, 'large', 20, 140.00, 2800.00),
(1, 2, 'medium', 34, 75.00, 2550.00),
(2, 5, 'medium', 40, 90.00, 3600.00),
(2, 3, 'large', 20, 115.00, 2600.00);

-- Initial Recorded Sales
INSERT INTO sales (vendor_id, sale_date, order_status, payment_status, payment_method, amount_paid, total_amount, balance_amount, delivery_type, delivery_lat, delivery_lng, distance_km, estimated_time_mins, batch_photo_url, batch_inspection_notes, notes) VALUES
(1, DATE_SUB(NOW(), INTERVAL 1 DAY), 'delivered', 'PAID', 'Cash', 390.00, 390.00, 0.00, 'delivery', -29.3138, 27.4842, 3.40, 12, 'https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6?auto=format&fit=crop&w=800&q=80', 'Depot QC Inspection: 2 Large Gala Apple Crates verified Grade-A before truck loading.', 'Morning drop-off at Kingsway stall'),
(2, DATE_SUB(NOW(), INTERVAL 3 HOUR), 'out_for_delivery', 'PAID', 'Mobile Money', 420.00, 420.00, 0.00, 'delivery', -29.3411, 27.4816, 6.20, 18, 'https://images.unsplash.com/photo-1611080626919-7cf5a9dbab5b?auto=format&fit=crop&w=800&q=80', 'Depot QC Inspection: 4 Medium Crates packed and sealed for driver dispatch.', 'En route to Thetsane circle'),
(1, NOW(), 'pending', 'UNPAID', 'Credit', 0.00, 490.00, 490.00, 'delivery', -29.3138, 27.4842, 3.40, 12, NULL, NULL, 'Fresh Gala order pending admin confirmation');

INSERT INTO sales_details (sale_id, fruit_id, packaging_size, quantity, unit_price, subtotal) VALUES
(1, 1, 'large', 2, 195.00, 390.00),
(2, 2, 'medium', 4, 105.00, 420.00),
(3, 4, 'medium', 2, 140.00, 280.00),
(3, 2, 'medium', 2, 105.00, 210.00);
