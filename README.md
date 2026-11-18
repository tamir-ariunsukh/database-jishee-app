# 🍔 Хүргэлт.mn — Хоол захиалга & хүргэлтийн fullstack систем

`database.txt` дээрх 19 хүснэгттэй PostgreSQL схем дээр бүтээсэн, бодитоор ажилладаг
хоол захиалгын платформ.

| Давхарга | Технологи |
| --- | --- |
| Database | PostgreSQL 18 (`db/schema.sql`, `db` seed скрипт) |
| Backend | Express 5 + TypeScript, `pg`, `zod`, JWT + bcrypt |
| Frontend | Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + **shadcn/ui** (Radix) |

---

## ✨ Боломжууд

**Хэрэглэгч (storefront)**

- Ресторан хайх, ангилал/эрэмбээр шүүх, үнэлгээ харах
- Рестораны цэс, бүтээгдэхүүний нэмэлт сонголт (хэмжээ, нэмэлт), тусгай заавар
- Сагс — сервер дээр хадгалагдана, нэг рестораны дүрэм, доод дүнгийн шалгалт
- Checkout — хаяг (олон хаяг, үндсэн хаяг), төлбөрийн хэлбэр, купон, тэмдэглэл
- Захиалгын түүх, статусын timeline, төлбөр, хүргэгчийн мэдээлэл
- Захиалга цуцлах, хүргэгдсэний дараа үнэлгээ өгөх
- Дуртай ресторан, профайл + хаягийн удирдлага

**Админ (`/admin`)**

- Dashboard: орлого, захиалга, идэвхтэй захиалга, 14 хоногийн график, шилдэг ресторан/хоол
- Захиалга — статус шинэчлэх, цуцлах, дэлгэрэнгүй харах
- Хүргэлт — хүргэгчид хуваарилах, явц хянах
- CRUD: Бүтээгдэхүүн, Ресторан, Ангилал, Хүргэгч, Купон, Үнэлгээ, Хэрэглэгч (эрх солих)

**Хүргэгч (`/admin/deliveries`)**

- Боломжтой хүргэлтийг хүлээн авах, "Хүргэж эхлэх" → "Хүргэсэн"

---

## 🚀 Ажиллуулах

### 1. Шаардлага

- Node.js 20+ (шалгасан: 26.x)
- PostgreSQL 14+ (шалгасан: 18.x), локал сервер ажиллаж байх
- `backend/.env` дотор датабаазын холболт тохируулна

```env
PORT=4000
CORS_ORIGIN=http://localhost:3000
ADMIN_DATABASE_URL=postgres://postgres:postgres@localhost:5432/postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/delivery_app
JWT_SECRET=change-this-super-secret-key-in-production
JWT_EXPIRES_IN=7d
```

> `frontend/.env.local` (эсвэл `.env.example`-аас хуулна):
> `NEXT_PUBLIC_API_URL=http://localhost:4000/api`

### 2. Хамаарал суулгах

```bash
npm run install:all
```

### 3. Датабааз бэлдэх (create → migrate → seed)

```bash
npm run db:setup
```

Энэ нь:
1. `delivery_app` датабаазыг үүсгэнэ
2. `db/schema.sql`-ийг ажиллуулна
3. 6 ресторан, 43 бүтээгдэхүүн, 73 захиалга, купон, хүргэгч зэрэг туршилтын өгөгдөл оруулна

### 4. Серверүүд

```bash
# терминал 1 — API (http://localhost:4000)
npm run backend

# терминал 2 — Next.js (http://localhost:3000)
npm run frontend
```

### 5. Нэвтрэх бүртгэлүүд

| Эрх | И-мэйл | Нууц үг |
| --- | --- | --- |
| Админ | `admin@delivery.mn` | `Admin123!` |
| Хэрэглэгч | `customer@delivery.mn` | `Customer123!` |
| Хүргэгч | `driver@delivery.mn` | `Driver123!` |

Купон: `WELCOME10` (10%), `DELIVERY5000` (5,000₮), `SUMMER20` (20%).

---

## 📁 Бүтэц

```
databaseweb/
├── database.txt            # Анхны схем (эх сурвалж)
├── db/
│   └── schema.sql           # Ажиллах схем (auth.users shim + индекс/триггер)
├── backend/
│   ├── src/
│   │   ├── app.ts           # Express app, error handler
│   │   ├── db.ts            # pg Pool, transaction helper
│   │   ├── middleware/auth.ts
│   │   ├── lib/             # crud.ts, cart.ts, pricing.ts, http.ts
│   │   ├── routes/          # auth, restaurants, products, cart, orders,
│   │   │                    # payments, deliveries, drivers, reviews,
│   │   │                    # coupons, favorites, stats ...
│   │   └── scripts/         # create-db, migrate, seed
│   └── .env
└── frontend/
    └── src/
        ├── app/
        │   ├── (shop)/      # Нүүр, ресторан, сагс, checkout, захиалга,
        │   │                # дуртай, профайл, login/register
        │   ├── admin/       # Dashboard + 9 CRUD хуудас
        │   └── layout.tsx
        ├── components/
        │   ├── ui/          # shadcn/ui компонентууд (button, dialog, table...)
        │   ├── admin/       # PageHeader, ConfirmDialog
        │   └── ...          # SiteHeader, RestaurantCard, StatusBadge
        └── lib/             # api.ts, providers.tsx, types.ts, format.ts
```

---

## 🔌 API товч жагсаалт

Бүх endpoint `/api` дор байна. Токеныг `Authorization: Bearer <token>` хэлбэрээр илгээнэ.

| Method | Endpoint | Тайлбар |
| --- | --- | --- |
| POST | `/auth/register`, `/auth/login` | Бүртгэл / нэвтрэх |
| GET/PATCH | `/auth/me` | Профайл |
| GET | `/categories`, `/restaurants`, `/restaurants/:id` | Каталог (public) |
| GET/POST/PATCH/DELETE | `/products`, `/products/:id/option-groups` | Цэс ба нэмэлтүүд |
| GET/POST/PATCH/DELETE | `/addresses` | Хаяг (өөрийн) |
| GET | `/cart` | Сагс + нийлбэр |
| POST/PATCH/DELETE | `/cart/items`, `/cart/items/:id` | Сагсны мөр |
| POST | `/orders` | Захиалга үүсгэх (сагснаас) |
| GET | `/orders`, `/orders/:id` | Захиалга (эрхээр шүүнэ) |
| PATCH | `/orders/:id/status` | Статус (админ/хүргэгч) |
| POST | `/orders/:id/cancel` | Цуцлах |
| POST | `/payments/orders/:orderId/pay` | Төлбөр (mock) |
| GET | `/deliveries`, `/deliveries/available` | Хүргэлт |
| POST | `/deliveries/:id/claim` | Хүргэгч хүлээн авах |
| GET/POST/PATCH/DELETE | `/drivers` | Хүргэгч (админ) |
| GET/POST | `/reviews` | Үнэлгээ |
| POST | `/coupons/validate` | Купон шалгах |
| GET/POST/PATCH/DELETE | `/coupons` | Купон (админ) |
| GET/POST/DELETE | `/favorites` | Дуртай ресторан |
| GET | `/admin/stats` | Dashboard статистик |
| GET/PATCH/DELETE | `/admin/users` | Хэрэглэгч, эрх |

---

## 📝 Тэмдэглэл

- `database.txt` дахь `auth.users` нь Supabase-ийн удирддаг хүснэгт тул локал
  PostgreSQL дээр `auth` схем + `auth.users(id, email, password_hash, role)` хэлбэрээр
  дахин үүсгэсэн. Бусад бүх хүснэгт, FK, CHECK, UNIQUE хязгаарлалт хэвээр.
- `cart_items` дээр `selected_options jsonb` багана нэмсэн — сагсан дахь нэмэлт
  сонголтыг хадгалах зорилгоор (`order_items` дээр аль хэдийн байсан).
- `orders.updated_at` автоматаар шинэчлэгдэх триггер, `restaurant_ratings` view,
  хайлт/шүүлтийн индексүүд нэмэгдсэн.
- Төлбөр нь **mock**: карт/QPay → `paid`, бэлэн мөнгө → хүргэгдэх үед `paid`.
- Үнэ, хямдрал, купоны дүнг сервер дээр дахин бодож, клиентийн илгээсэн үнийг
  хэзээ ч ашиглахгүй.
