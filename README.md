# English vocab (kickoff)

Nx + pnpm: `apps/web` (học sinh), `apps/admin` (CMS), `apps/api` (Nest + Prisma).

## Chạy local

Postgres: `docker compose up -d` (cần Docker Desktop) **hoặc** sửa `DATABASE_URL` trong `.env` cho user local của bạn, rồi:

```bash
cp .env.example .env
# chỉnh DATABASE_URL nếu không dùng docker compose
docker compose up -d   # nếu Docker đang chạy
pnpm install
pnpm exec prisma generate --schema=apps/api/prisma/schema.prisma
pnpm exec prisma migrate deploy --schema=apps/api/prisma/schema.prisma
pnpm prisma:seed
pnpm exec nx serve api
pnpm exec nx dev web
pnpm exec nx dev admin
```

- Học sinh: http://localhost:3000
- Admin: http://localhost:3001 (admin / admin)
- API: http://localhost:3333/api

## Dữ liệu mẫu để xem cấu hình Admin

Chạy `pnpm prisma:seed:demo` để thêm cấu hình minh họa cho Khối 1 trên database local `english`: 10 unit, 120 liên kết từ–unit, đủ nghĩa tiếng Việt/loại từ/category, không có ảnh và không tạo tài khoản hoặc lịch sử học sinh. Đây là nội dung minh họa cách cấu hình, không đại diện cho một bộ sách cụ thể.

Mẫu có `orange` với nghĩa quả cam và màu cam; `watch` là danh từ và động từ; từ dùng chung ở nhiều unit và category riêng theo unit. Unit 1–6 mở, Unit 7–8 mở sau 7/14 ngày kể từ ngày seed, Unit 9 chưa đặt lịch, Unit 10 khóa tay. Có cả chế độ phân nhóm Từng từ và Bảng phân nhóm; cả bốn hoạt động được bật.

Lệnh chỉ thêm hồ sơ/liên kết còn thiếu, giữ nguyên nội dung và lịch đã có khi chạy lại. Seed mặc định `pnpm prisma:seed` vẫn chỉ khởi tạo khối 1–5; demo seed bị chặn ngoài database local và trong production.

Chi tiết: `docs/TECH.md`. Kho từ Admin nằm tại `/content`, lịch mở unit tại `/units`. Seed chỉ khởi tạo khối 1–5; thêm từ và đặt lịch trong Admin. Xem `docs/RAILWAY.md` cho bản nâng cấp yêu cầu database sạch.

## Lưu ảnh trên Railway hoặc Cloudflare R2

Railway: xem [cấu hình BUCKET\_\* và CORS](docs/RAILWAY.md#image-storage), điền credentials vào `.env` của API rồi khởi động lại API. Để trống các biến R2\_\* khi dùng Railway. Cloudflare R2: xem [hướng dẫn tạo bucket, credentials và CORS](docs/R2.md). Mẫu CORS local cho cả hai provider nằm ở `config/cloudflare/r2-cors.local.json`. Bucket dùng private access và URL ký sẵn; không cần đổi database.
