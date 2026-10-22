# Tech

Nx + pnpm monorepo.

| App          | Role                                                           |
| ------------ | -------------------------------------------------------------- |
| `apps/web`   | Học sinh — Next.js App Router, responsive mobile và desktop/TV |
| `apps/admin` | CMS — Next.js, desktop forms                                   |
| `apps/api`   | NestJS + Prisma                                                |

`libs/shared` — enum hoạt động, DTO nhỏ.

## Commands

```bash
pnpm install
pnpm exec nx serve api
pnpm exec nx serve web
pnpm exec nx serve admin
```

Postgres: `DATABASE_URL`. Single admin: `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`. Redis: `REDIS_URL`. Security configuration and limits: [SECURITY.md](SECURITY.md). Frontends: `NEXT_PUBLIC_API_URL`. Production student sessions require `STUDENT_SESSION_SECRET` (at least 32 characters); local development generates a temporary secret if unset, invalidating sessions on restart.

## Auth

- **Student:** login with username + password (bcrypt). Registration also requires display name, grade, and matching password confirmation; school and class are optional. Signed HttpOnly `student_session` cookie embeds an expiry. Routes `/api/student/auth`; register/login/me return nullable `avatarKey`. Authenticated `PATCH /api/students/:id` updates own name, school/class, grade, and optional `avatarKey`; grade changes retain prior attempts. Avatar keys must start with `uploads/avatars/{signedInStudentId}/` and contain no `..`; null clears a photo. Play + weekly report use the verified session student.
- **Admin:** one env `ADMIN_USERNAME` / `ADMIN_PASSWORD` account; signed `admin_session` cookie expires after eight hours and validates current credentials. No `admin_users` table. All writes require an allowed Origin and `X-App-Request: 1`. See [SECURITY.md](SECURITY.md).

## Media

Cloudflare R2 qua S3 API, bucket private. Admin/Student lấy presigned PUT URL từ API và upload trực tiếp; `GET /api/media?key=` cấp URL GET có hạn cho key đã lưu: media từ vựng công khai, avatar chỉ chủ tài khoản. Dùng `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` ở API; `R2_ENDPOINT` tùy chọn cho bucket jurisdiction. R2 được ưu tiên nguyên bộ, không trộn với BUCKET*\*; khi R2*\* trống thì dùng cấu hình S3 cũ. Ảnh do người soạn upload, không gọi API tạo ảnh. Xem [hướng dẫn R2](R2.md).

Ảnh đại diện học sinh dùng `POST /api/student/uploads/presign` với StudentGuard, không dùng route admin. Chỉ nhận MIME JPEG/PNG/WebP/GIF, tạo UUID + tên file đã làm sạch dưới `uploads/avatars/{studentId}/`, rồi client PUT và PATCH hồ sơ. Đăng ký tạo tài khoản/cookie trước khi tải ảnh; nếu tải ảnh lỗi, giữ tài khoản và dữ liệu form, cho thử lại hoặc vào học không có ảnh. Cài đặt tải ảnh mới trước khi lưu hồ sơ; khi lỗi giữ các thay đổi chưa lưu. Client giữ key đã PUT trong lượt chỉnh sửa để PATCH lại mà không tạo bản upload thứ hai. Ảnh hiển thị qua `/api/media`; bucket CORS cần cho PUT từ origin của web.

Admin `/content` là kho từ A–Z với drawer sửa nội dung/ảnh và bộ lọc thiếu dữ liệu. Upload dùng `POST /api/admin/uploads/presign` → PUT với contentType trả về (URL upload hạn 10 phút, URL xem hạn 1 giờ) → lưu imageKey của hồ sơ; lỗi lưu giữ key để thử lại. Cần cấu hình R2 và bucket CORS cho origin Admin. Thiếu cấu hình trả 501.

Admin API: `GET /api/admin/words` nhận q, lemma, grades, units, categories, quick, initial, offset. Các danh sách ID phân cách dấu phẩy; quick nhận missing-image, missing-meaning, unassigned, unplayable. Trả total, counts theo A–Z/#, orderedIds, groups (50 mục đầu mỗi nhóm), items, hasMore. Khi có initial, items là trang 50 mục của nhóm. `GET/POST/PATCH /api/admin/words[/:id]` quản lý hồ sơ chung và danh sách units với categoryIds riêng. `GET /api/admin/grades` trả unit/hoạt động, trạng thái lịch và khả năng bảng phân nhóm; `POST/PATCH /api/admin/units[/:id]` tạo/sửa, `POST /api/admin/units/schedule` đặt lịch hàng loạt. Category dùng GET/POST/PATCH. Admin auth giữ nguyên.

## API modules

| Module           | Routes                                                                                                                                                                                                                                                           |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Health           | `GET /api/health`                                                                                                                                                                                                                                                |
| Admin auth       | `/api/admin/auth` login/logout/me                                                                                                                                                                                                                                |
| Student auth     | `/api/student/auth` register/login/logout/me                                                                                                                                                                                                                     |
| Curriculum       | `/api/admin/grades`, `/api/admin/units`, `/api/admin/words`, `/api/admin/categories` create/update + lịch mở + hoạt động; Word chung / UnitWord liên kết với category riêng                                                                                      |
| Excel import     | `POST /api/admin/word-import?mode=preview\|commit` (admin cookie, multipart field `file`, `.xlsx` ≤2 MiB); template at `/templates/vocabulary-import-v1.xlsx` in admin app                                                                                       |
| Uploads          | `POST /api/admin/uploads/presign` (admin), `POST /api/student/uploads/presign` (student avatar), `GET /api/media?key=`                                                                                                                                           |
| Catalog / play   | `/api/grades`, `/api/units`, `/api/play/*`, `PATCH /api/students/:id`                                                                                                                                                                                            |
| Sổ từ / Ôn nhanh | `GET /api/learning/wordbook`; `POST /api/learning/review/sessions`, `GET /api/learning/review/sessions/:id`, `POST /api/learning/review/sessions/:id/answers`, `PATCH /api/learning/review/sessions/:id/heartbeat`, `POST /api/learning/review/sessions/:id/end` |
| Reports          | `GET /api/reports/weekly` (selected grade only; includes seven-day activity)                                                                                                                                                                                     |

Ôn nhanh có bảng session/question riêng và snapshot nghĩa/nhãn lựa chọn khi tạo round. API chỉ trả nghĩa và 3 lựa chọn trước khi trả lời, lưu lựa chọn trên server đúng một lần và trả lại kết quả cũ nếu gửi trùng. Session cũ chỉ xem/tiếp tục được khi vẫn thuộc học sinh, khối đang chọn và nội dung chưa bị khóa. Client giữ ID trong `sessionStorage`; thoát kết thúc session, tải lại không kết thúc. Review `active_ms` tính khi tab hiện và focus; chỉ cộng vào phút luyện và streak, không vào mastery.

Excel import v1 giới hạn 50 units, 100 nhóm, 2.000 từ. Preview chỉ đọc và trả `ok`, `counts`, `warnings`, `errors` có tab/dòng/cột. Commit đọc và kiểm tra lại file trong transaction serializable trước khi tạo unit cùng bốn hoạt động, nhóm, từ và quan hệ nhóm. Mã/tiêu đề hoặc chế độ unit có sẵn mâu thuẫn là lỗi; nhóm/từ có sẵn không bị ghi đè. Chỉ đọc cột nhập liệu; công thức trong ô nhập liệu bị từ chối. Ảnh và audio key không thuộc file nhập.

Xem `docs/DATA.md`, `docs/ACTIVITIES.md`, `docs/UX.md`, `docs/RAILWAY.md`.
