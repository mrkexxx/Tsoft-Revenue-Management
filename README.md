
# Dự án Quản lý Doanh thu Tsoft

Đây là một ứng dụng web React được xây dựng để quản lý doanh thu bán hàng cho Tsoft và các đại lý.

## Tính năng chính

- **Phân quyền người dùng:** Admin và Đại lý (Agent).
- **Admin:** Quản lý toàn bộ hệ thống, xem doanh thu của tất cả đại lý, tạo gói bán, tạo đơn hàng cho mọi đại lý.
- **Đại lý:** Chỉ xem và tạo đơn hàng của chính mình.
- **Dashboard:** Giao diện trực quan với các chỉ số tổng quan, biểu đồ doanh thu theo ngày/tháng.
- **Quản lý đơn hàng:** Lọc, tìm kiếm và xem danh sách đơn hàng.
- **Xuất dữ liệu:** Xuất danh sách đơn hàng hiện tại ra file CSV.

## Công nghệ sử dụng

- **Frontend:** React 18, TypeScript, Vite
- **Styling:** Tailwind CSS
- **Biểu đồ:** Recharts
- **Backend (Mô phỏng):** Dữ liệu giả lập trong code để chạy demo. Hướng dẫn bên dưới mô tả cách kết nối với backend thật như Supabase.

---

## 1. Hướng dẫn chạy Local

### Yêu cầu
- Node.js (phiên bản 18.x trở lên)
- `npm` hoặc `yarn`

### Các bước cài đặt

**Bước 1: Sao chép mã nguồn**

Tải và giải nén toàn bộ các file mã nguồn vào một thư mục trên máy tính của bạn, ví dụ `tsoft-revenue-app`.

**Bước 2: Cài đặt dependencies**

Mở terminal hoặc command prompt, di chuyển vào thư mục dự án và chạy lệnh:

```bash
npm install
```
*Lệnh này sẽ cài đặt các thư viện cần thiết được định nghĩa trong file `package.json`.*

**Bước 3: Chạy ứng dụng**

Sau khi cài đặt xong, chạy lệnh sau để khởi động server phát triển:
```bash
npm run dev
```

Ứng dụng sẽ chạy tại địa chỉ `http://localhost:5173` (hoặc một port khác nếu 5173 đã được sử dụng). Mở trình duyệt và truy cập địa chỉ này.

### Tài khoản đăng nhập mặc định
- **Username:** `admin`
- **Password:** `admin`

---

## 2. Hướng dẫn kết nối Backend (Phiên bản B: Supabase)

Ứng dụng này được thiết kế để dễ dàng kết nối với một backend thực tế. Dưới đây là hướng dẫn để kết nối với Supabase.

### Bước 1: Thiết lập Supabase

1. Truy cập [Supabase](https://supabase.com/) và tạo một project mới.
2. Trong project của bạn, vào mục **SQL Editor** và chạy các câu lệnh SQL để tạo bảng `packages`, `orders`. Bạn cũng có thể sử dụng bảng `users` có sẵn của Supabase Auth.
3. Vào **Project Settings > API**. Tìm và lưu lại **Project URL** và **anon public key**.

### Bước 2: Cấu hình biến môi trường

1. Tạo một file tên là `.env.local` ở thư mục gốc của dự án.
2. Thêm các biến môi trường sau vào file:

```env
VITE_SUPABASE_URL="YOUR_SUPABASE_PROJECT_URL"
VITE_SUPABASE_ANON_KEY="YOUR_SUPABASE_ANON_PUBLIC_KEY"
```
Thay thế `YOUR_...` bằng các giá trị bạn đã lấy ở Bước 1.

### Bước 3: Cập nhật API Client

Mở file `src/services/api.ts` và thay thế code mock bằng code gọi API Supabase.

**Ví dụ:**

```typescript
// src/services/api.ts
import { createClient } from '@supabase/supabase-js';
import { Order, Package } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const api = {
  getOrders: async (): Promise<Order[]> => {
    const { data, error } = await supabase.from('orders').select('*');
    if (error) throw error;
    return data;
  },
  // ... implement các hàm getPackages, createOrder tương tự
};
```

*Lưu ý: Bạn cần cài đặt thư viện Supabase: `npm install @supabase/supabase-js`*

---

## 3. Hướng dẫn triển khai (Deploy)

Bạn có thể dễ dàng triển khai ứng dụng này lên các nền tảng như Vercel hoặc Netlify.

### Triển khai lên Vercel

1. **Push code lên GitHub/GitLab/Bitbucket:** Đảm bảo code của bạn đã được đưa lên một repository Git.
2. **Tạo project trên Vercel:**
   - Đăng nhập Vercel và chọn "Add New... > Project".
   - Import Git repository của bạn.
3. **Cấu hình Project:**
   - Vercel sẽ tự động nhận diện đây là dự án Vite. Các thiết lập build thường là chính xác.
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. **Thêm biến môi trường:**
   - Vào tab **Settings > Environment Variables**.
   - Thêm các biến `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` nếu bạn kết nối với Supabase.
5. **Deploy:** Nhấn nút "Deploy". Vercel sẽ build và triển khai ứng dụng của bạn. File `vercel.json` đã được cung cấp để xử lý routing cho SPA.

### Triển khai lên Netlify

1. **Push code lên repository Git.**
2. **Tạo site trên Netlify:**
   - Đăng nhập Netlify, chọn "Add new site > Import an existing project".
   - Kết nối với Git provider và chọn repository.
3. **Cấu hình Build:**
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
4. **Thêm biến môi trường:**
   - Vào **Site settings > Build & deploy > Environment**.
   - Thêm các biến môi trường cần thiết.
5. **Xử lý routing cho SPA:**
   - Netlify cần biết cách xử lý các route của React. Tạo một file tên `_redirects` trong thư mục `public` (nếu không có thì tạo mới) với nội dung sau:
     ```
     /*    /index.html   200
     ```
   - Hoặc, tạo file `netlify.toml` ở thư mục gốc với nội dung:
     ```toml
     [build]
       command = "npm run build"
       publish = "dist"
     
     [[redirects]]
       from = "/*"
       to = "/index.html"
       status = 200
     ```
6. **Deploy:** Nhấn "Deploy site".

Sau khi triển khai, bạn sẽ nhận được một URL công khai để truy cập ứng dụng.
