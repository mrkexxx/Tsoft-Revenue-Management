-- Chạy đoạn mã SQL này trong Supabase SQL Editor để tạo các bảng và dữ liệu mẫu

-- 1. Tạo bảng users
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  "isActive" BOOLEAN DEFAULT true,
  "discountPercentage" INTEGER DEFAULT 0
);

-- Thêm tài khoản admin mặc định (username: admin, password: 1)
INSERT INTO users (username, password, name, role, "isActive", "discountPercentage")
VALUES ('admin', '1', 'Admin Tifo', 'ADMIN', true, 0);

-- Thêm tài khoản đại lý mẫu
INSERT INTO users (username, password, name, role, "isActive", "discountPercentage")
VALUES ('thuytien', 'password', 'Thuỷ Tiên', 'AGENT', true, 25);

-- 2. Tạo bảng packages
CREATE TABLE packages (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER NOT NULL
);

-- Thêm các gói mặc định
INSERT INTO packages (name, price) VALUES
('Gói 1 tháng', 400000),
('Gói 3 tháng', 800000),
('Gói 6 tháng', 1200000),
('Gói 1 năm', 1200000);

-- 3. Tạo bảng orders
CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  account_name TEXT NOT NULL,
  account_email TEXT NOT NULL,
  "packageId" INTEGER REFERENCES packages(id),
  price INTEGER NOT NULL,
  actual_revenue INTEGER,
  status TEXT NOT NULL,
  "paymentStatus" TEXT NOT NULL,
  "agentId" INTEGER REFERENCES users(id),
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- 4. Tạo bảng daily_debts
CREATE TABLE daily_debts (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL
);

-- 5. Tạo bảng admin_logs
CREATE TABLE admin_logs (
  id SERIAL PRIMARY KEY,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "adminId" INTEGER REFERENCES users(id),
  "adminName" TEXT NOT NULL,
  description TEXT NOT NULL
);
