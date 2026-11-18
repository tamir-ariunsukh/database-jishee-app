import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';

/* ------------------------------------------------------------------ */
/*  Deterministic helpers                                             */
/* ------------------------------------------------------------------ */

let seedState = 20260418;
const rand = () => {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
};
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)];
const int = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const image = (seed: string) => `https://picsum.photos/seed/${seed}/900/600`;
const daysAgoAt = (days: number, hour: number, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/* ------------------------------------------------------------------ */
/*  Reference data                                                    */
/* ------------------------------------------------------------------ */

const CATEGORIES = [
  ['Бургер', 'burger'],
  ['Пицца', 'pizza'],
  ['Суши', 'sushi'],
  ['Ази хоол', 'asian'],
  ['Салат', 'salad'],
  ['Хачирсан хоол', 'snacks'],
  ['Ундаа', 'drinks'],
  ['Амттан', 'dessert'],
  ['Кофе', 'coffee'],
];

interface RestaurantSeed {
  name: string;
  slug: string;
  description: string;
  phone: string;
  address: string;
  delivery_fee: number;
  min_order_amount: number;
  minutes: number;
  products: [name: string, price: number, category: string, description: string, discount?: number][];
}

const RESTAURANTS: RestaurantSeed[] = [
  {
    name: 'Burger House',
    slug: 'burger-house',
    description: 'Гараар бэлтгэсэн үхрийн махтай жинхэнэ америк бургер.',
    phone: '+976 7711 2233',
    address: 'Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Энхтайваны өргөн чөлөө 15',
    delivery_fee: 3000,
    min_order_amount: 15000,
    minutes: 25,
    products: [
      ['Классик Чизбургер', 12900, 'Бургер', 'Үхрийн мах, чеддар бяслаг, тусгай соус, шинэ ногоо'],
      ['Давхар Чизбургер', 17900, 'Бургер', 'Хоёр давхар мах, гурван зүсмэл бяслаг', 15900],
      ['Чикен Бургер', 11900, 'Бургер', 'Шарсан тахианы мах, майонез, салат'],
      ['Бекон Бургер', 15900, 'Бургер', 'Шаржигнуур бекон, карамелжсэн сонгино'],
      ['Картофель фри', 4900, 'Хачирсан хоол', 'Алтан шаргал фри, далайн давс'],
      ['Сонгины цагираг', 5900, 'Хачирсан хоол', '6 ширхэг, чили соустай'],
      ['Coca-Cola 0.5л', 2500, 'Ундаа', 'Хөргөсөн ундаа'],
      ['Шоколадтай кекс', 6900, 'Амттан', 'Халуун шоколадтай лаав кекс'],
    ],
  },
  {
    name: 'Pizza Roma',
    slug: 'pizza-roma',
    description: 'Чулуун зууханд бичсэн итали пицца, 24 цагийн гурилан зуурмаг.',
    phone: '+976 7700 4455',
    address: 'Улаанбаатар, Хан-Уул дүүрэг, Зайсан, 3-р хороо',
    delivery_fee: 4000,
    min_order_amount: 20000,
    minutes: 35,
    products: [
      ['Маргарита', 22000, 'Пицца', 'Сан Марзано улаан лооль, моцарелла, базилик'],
      ['Пепперони', 26000, 'Пицца', 'Пепперони, моцарелла, орегано', 23000],
      ['Дөрвөн бяслаг', 28000, 'Пицца', 'Моцарелла, горгонзола, пармезан, чеддар'],
      ['Гахайн махтай', 27000, 'Пицца', 'Хатаасан гахайн мах, сонгино, чинжүү'],
      ['Цезарь салат', 14000, 'Салат', 'Романо, пармезан, крутон, тахиа'],
      ['Сармистай талх', 6900, 'Хачирсан хоол', 'Цөцгийн тос, сармис, моцарелла'],
      ['Спрайт 0.5л', 2500, 'Ундаа', 'Хөргөсөн ундаа'],
      ['Тирамису', 8900, 'Амттан', 'Итали классик амттан'],
    ],
  },
  {
    name: 'Sushi Zen',
    slug: 'sushi-zen',
    description: 'Өдөр бүр шинэ загас, япон мастерын гарт бүтсэн суши.',
    phone: '+976 7722 8899',
    address: 'Улаанбаатар, Баянзүрх дүүрэг, Их тойруу 12',
    delivery_fee: 5000,
    min_order_amount: 25000,
    minutes: 40,
    products: [
      ['Филадельфия ролл', 32000, 'Суши', 'Лосось, крем бяслаг, өргөст хэмх'],
      ['Калифорни ролл', 24000, 'Суши', 'Хавч, авокадо, тобико'],
      ['Нигири лосось', 8900, 'Суши', '2 ширхэг, шинэ лосось'],
      ['Тэмпура ролл', 26000, 'Суши', 'Шарсан креветка, спайси соус', 22000],
      ['Мисо шөл', 6900, 'Ази хоол', 'Тофу, вакаме, ногоон сонгино'],
      ['Эдамаме', 5900, 'Салат', 'Давсалсан ногоон шош'],
      ['Ногоон цай', 2500, 'Ундаа', 'Халуун сенча цай'],
    ],
  },
  {
    name: 'Noodle Bar',
    slug: 'noodle-bar',
    description: 'Азийн гудамжны хоол: рамен, фо, пад тай, гоймон.',
    phone: '+976 7733 1122',
    address: 'Улаанбаатар, Чингэлтэй дүүрэг, 4-р хороо, Сөүлийн гудамж',
    delivery_fee: 3000,
    min_order_amount: 15000,
    minutes: 30,
    products: [
      ['Тонкоцу Рамен', 18900, 'Ази хоол', 'Гахайн ясны шөл, чашу, өндөг'],
      ['Фо бо', 17900, 'Ази хоол', 'Үхрийн мах, ориз гоймон, базилик'],
      ['Шарсан гоймон', 15900, 'Ази хоол', 'Хүнсний ногоо, тахиа, соя соус'],
      ['Пад Тай', 16900, 'Ази хоол', 'Ориз гоймон, сам хорхой, самрын соус', 14500],
      ['Дамплинг', 8900, 'Хачирсан хоол', '6 ширхэг уурын банш'],
      ['Кимчи', 4900, 'Салат', 'Исгэсэн байцаа, чили'],
      ['Лиймонад', 3500, 'Ундаа', 'Гэрийн лиймонад'],
    ],
  },
  {
    name: 'Green Bowl',
    slug: 'green-bowl',
    description: 'Эрүүл, шинэ ногоотой салат, поке боул.',
    phone: '+976 7744 5566',
    address: 'Улаанбаатар, Сүхбаатар дүүрэг, 8-р хороо, Бaga тогруу 5',
    delivery_fee: 2500,
    min_order_amount: 12000,
    minutes: 20,
    products: [
      ['Цезарь салат', 14900, 'Салат', 'Романо, тахиа, пармезан'],
      ['Грек салат', 13900, 'Салат', 'Фета, маслин, өргөст хэмх'],
      ['Поке боул', 18900, 'Салат', 'Түүхий туна, авокадо, киноа', 16900],
      ['Киноа боул', 17900, 'Салат', 'Киноа, хумс, ногоо'],
      ['Авокадо тост', 11900, 'Хачирсан хоол', 'Хөх тарианы талх, өндөг'],
      ['Жимсний смузи', 7900, 'Ундаа', 'Гүзээлзгэнэ, банан, овъёосны сүү'],
    ],
  },
  {
    name: 'Coffee Lab',
    slug: 'coffee-lab',
    description: 'Гар аргаар шарсан кофе, шинэхэн жигнэсэн амттан.',
    phone: '+976 7755 7788',
    address: 'Улаанбаатар, Сүхбаатар дүүрэг, 1-р хороо, Жуулчны гудамж 7',
    delivery_fee: 2000,
    min_order_amount: 8000,
    minutes: 15,
    products: [
      ['Американо', 5500, 'Кофе', 'Double shot espresso, халуун ус'],
      ['Латте', 7500, 'Кофе', 'Эспрессо, уурын сүү'],
      ['Капучино', 7500, 'Кофе', 'Зузаан сүүн хөөс'],
      ['Карамель макиато', 8900, 'Кофе', 'Карамель сироп, эспрессо'],
      ['Круассан', 6500, 'Амттан', 'Цөцгийн тостой франц круассан'],
      ['Чизкейк', 8900, 'Амттан', 'Нью-Йорк стиль чизкейк'],
      ['Айс кофе', 7900, 'Кофе', 'Хүйтэн кофе, мөс'],
    ],
  },
];

const REVIEW_COMMENTS = [
  'Хүргэлт маш хурдан байлаа, хоол нь халуун.',
  'Амттай, дахин захиалах нь гарцаагүй!',
  'Сайн байсан, гэхдээ бага зэрэг хүлээх хэрэгтэй болсон.',
  'Үйлчилгээ маш сайн, баглаа боодол цэвэрхэн.',
  'Үнэ нь чанартайгаа тохирсон. Баярлалаа!',
  'Миний дуртай газар, хэзээ ч урам хугарахгүй.',
  'Хүргэлтийн хүн маш эелдэг байсан.',
  'Порц хэмжээ сайн, амттай байсан.',
];

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('→ Existing data-г цэвэрлэж байна...');
    await client.query(`
      TRUNCATE TABLE
        public.coupon_usages, public.coupons, public.order_status_history,
        public.deliveries, public.payments, public.order_items, public.orders,
        public.cart_items, public.carts, public.reviews, public.favorites,
        public.restaurant_hours, public.product_options, public.product_option_groups,
        public.products, public.categories, public.restaurants,
        public.addresses, public.drivers, public.profiles, auth.users
      RESTART IDENTITY CASCADE
    `);

    const insert = async (table: string, data: Record<string, unknown>) => {
      const keys = Object.keys(data);
      const result = await client.query(
        `INSERT INTO ${table} (${keys.map((k) => `"${k}"`).join(', ')})
         VALUES (${keys.map((_, i) => `$${i + 1}`).join(', ')})
         RETURNING *`,
        keys.map((k) => data[k]),
      );
      return result.rows[0] as Record<string, any>;
    };

    /* --------------------------- users --------------------------- */

    console.log('→ Хэрэглэгчид...');
    const adminHash = await bcrypt.hash('Admin123!', 10);
    const customerHash = await bcrypt.hash('Customer123!', 10);
    const driverHash = await bcrypt.hash('Driver123!', 10);

    const admin = await insert('auth.users', {
      email: 'admin@delivery.mn',
      password_hash: adminHash,
      role: 'admin',
    });
    await insert('public.profiles', {
      id: admin.id,
      full_name: 'Админ Баяр',
      phone: '+976 9900 0001',
    });

    const CUSTOMERS = [
      ['customer@delivery.mn', 'Батбаяр Эрдэнэ', '+976 9911 2233'],
      ['saraa@delivery.mn', 'Сараа Болд', '+976 9922 3344'],
      ['temka@delivery.mn', 'Тэмка Ганбат', '+976 9933 4455'],
      ['anu@delivery.mn', 'Ануужин Дорж', '+976 9944 5566'],
      ['zaya@delivery.mn', 'Заяа Мөнх', '+976 9955 6677'],
    ];

    const customers: { id: string; email: string; full_name: string }[] = [];
    for (const [email, fullName, phone] of CUSTOMERS) {
      const user = await insert('auth.users', {
        email,
        password_hash: customerHash,
        role: 'customer',
      });
      await insert('public.profiles', { id: user.id, full_name: fullName, phone });
      customers.push({ id: user.id, email, full_name: fullName });
    }

    const DRIVERS = [
      ['driver@delivery.mn', 'Дорж Хүргэгч', '+976 8811 0011'],
      ['driver2@delivery.mn', 'Нараа Хүргэгч', '+976 8822 0022'],
      ['driver3@delivery.mn', 'Түвшин Хүргэгч', '+976 8833 0033'],
    ];

    const drivers: { id: string; full_name: string }[] = [];
    for (const [email, fullName, phone] of DRIVERS) {
      const user = await insert('auth.users', {
        email,
        password_hash: driverHash,
        role: 'driver',
      });
      await insert('public.profiles', { id: user.id, full_name: fullName, phone });
      await insert('public.drivers', {
        id: user.id,
        full_name: fullName,
        phone,
        is_available: true,
        latitude: 47.9184,
        longitude: 106.9177,
      });
      drivers.push({ id: user.id, full_name: fullName });
    }

    /* ------------------------- addresses ------------------------- */

    console.log('→ Хаягууд...');
    const ADDRESS_SETS = [
      [
        ['Гэр', 'Сүхбаатар дүүрэг, 1-р хороо, Энхтайваны өргөн чөлөө 21', '12', '2', '5'],
        ['Ажил', 'Хан-Уул дүүрэг, Зайсан, 3-р хороо, Тэди хотхон B блок', '304', '1', '3'],
      ],
      [['Гэр', 'Баянзүрх дүүрэг, 26-р хороо, 3-р хороолол 45', '8', '3', '2']],
      [['Гэр', 'Чингэлтэй дүүрэг, 4-р хороо, Сөүлийн гудамж 12', '5', '1', '4']],
      [['Гэр', 'Сонгинохайрхан дүүрэг, 20-р хороо, 1-р хороолол 7', '22', '4', '2']],
      [['Гэр', 'Сүхбаатар дүүрэг, 6-р хороо, Их сургуулийн гудамж 9', '3', '2', '1']],
    ];

    const customerAddresses: Record<string, string[]> = {};
    for (const [index, customer] of customers.entries()) {
      customerAddresses[customer.id] = [];
      for (const [i, [title, address, apartment, entrance, floor]] of ADDRESS_SETS[index].entries()) {
        const created = await insert('public.addresses', {
          user_id: customer.id,
          title,
          address,
          apartment,
          entrance,
          floor,
          is_default: i === 0,
          latitude: Number((47.9 + rand() * 0.1).toFixed(6)),
          longitude: Number((106.85 + rand() * 0.1).toFixed(6)),
        });
        customerAddresses[customer.id].push(created.id);
      }
    }

    /* ------------------------ categories ------------------------- */

    console.log('→ Ангилал...');
    const categoryIds: Record<string, string> = {};
    for (const [index, [name, slug]] of CATEGORIES.entries()) {
      const row = await insert('public.categories', {
        name,
        image_url: image(`category-${slug}`),
        sort_order: index + 1,
        is_active: true,
      });
      categoryIds[name] = row.id;
    }

    /* ------------------------ restaurants ------------------------ */

    console.log('→ Ресторанууд, цэс...');
    const productIds: { id: string; name: string; price: number; restaurantId: string }[] = [];
    const restaurants: { id: string; name: string; delivery_fee: number; products: string[] }[] = [];

    for (const [index, restaurant] of RESTAURANTS.entries()) {
      const row = await insert('public.restaurants', {
        name: restaurant.name,
        description: restaurant.description,
        logo_url: image(`logo-${restaurant.slug}`),
        cover_url: image(`cover-${restaurant.slug}`),
        phone: restaurant.phone,
        address: restaurant.address,
        latitude: 47.91 + index * 0.005,
        longitude: 106.9 + index * 0.004,
        delivery_fee: restaurant.delivery_fee,
        min_order_amount: restaurant.min_order_amount,
        estimated_delivery_minutes: restaurant.minutes,
        is_active: true,
      });

      const ids: string[] = [];
      for (const [pIndex, [name, price, category, description, discount]] of restaurant.products.entries()) {
        const product = await insert('public.products', {
          restaurant_id: row.id,
          category_id: categoryIds[category],
          name,
          description,
          image_url: image(`${restaurant.slug}-${pIndex}`),
          price,
          discount_price: discount ?? null,
          is_available: true,
          preparation_minutes: int(8, 25),
        });
        ids.push(product.id);
        productIds.push({
          id: product.id,
          name,
          price: discount ?? price,
          restaurantId: row.id,
        });
      }

      restaurants.push({
        id: row.id,
        name: restaurant.name,
        delivery_fee: restaurant.delivery_fee,
        products: ids,
      });

      // opening hours
      for (let day = 0; day < 7; day += 1) {
        await insert('public.restaurant_hours', {
          restaurant_id: row.id,
          day_of_week: day,
          open_time: '10:00',
          close_time: '22:00',
          is_closed: day === 1 && index % 2 === 0,
        });
      }
    }

    /* ------------------------- options --------------------------- */

    console.log('→ Нэмэлт сонголтууд...');
    for (const product of productIds) {
      const isBurger = ['Классик Чизбургер', 'Давхар Чизбургер', 'Чикен Бургер', 'Бекон Бургер'].includes(
        product.name,
      );
      const isPizza = ['Маргарита', 'Пепперони', 'Дөрвөн бяслаг', 'Гахайн махтай'].includes(product.name);
      const isCoffee = ['Американо', 'Латте', 'Капучино', 'Карамель макиато', 'Айс кофе'].includes(product.name);

      if (isBurger) {
        const size = await insert('public.product_option_groups', {
          product_id: product.id,
          name: 'Хэмжээ',
          required: true,
          min_select: 1,
          max_select: 1,
        });
        await insert('public.product_options', { group_id: size.id, name: 'Стандарт', additional_price: 0 });
        await insert('public.product_options', { group_id: size.id, name: 'Том', additional_price: 3000 });

        const extras = await insert('public.product_option_groups', {
          product_id: product.id,
          name: 'Нэмэлт',
          required: false,
          min_select: 0,
          max_select: 3,
        });
        for (const [name, price] of [['Бяслаг', 2000], ['Бекон', 3000], ['Өндөг', 1500]]) {
          await insert('public.product_options', {
            group_id: extras.id,
            name,
            additional_price: price,
          });
        }
      }

      if (isPizza) {
        const size = await insert('public.product_option_groups', {
          product_id: product.id,
          name: 'Хэмжээ',
          required: true,
          min_select: 1,
          max_select: 1,
        });
        await insert('public.product_options', { group_id: size.id, name: '30 см', additional_price: 0 });
        await insert('public.product_options', { group_id: size.id, name: '40 см', additional_price: 8000 });

        const crust = await insert('public.product_option_groups', {
          product_id: product.id,
          name: 'Хальс',
          required: true,
          min_select: 1,
          max_select: 1,
        });
        for (const [name, price] of [['Тонийм', 0], ['Зузаан', 2000], ['Бяслагтай зах', 4000]]) {
          await insert('public.product_options', { group_id: crust.id, name, additional_price: price });
        }
      }

      if (isCoffee) {
        const milk = await insert('public.product_option_groups', {
          product_id: product.id,
          name: 'Сүү',
          required: false,
          min_select: 0,
          max_select: 1,
        });
        for (const [name, price] of [['Энгийн', 0], ['Овъёос', 1500], ['Бадам', 1500]]) {
          await insert('public.product_options', { group_id: milk.id, name, additional_price: price });
        }
      }
    }

    /* ------------------------- coupons --------------------------- */

    console.log('→ Купонууд...');
    const coupons = [
      ['WELCOME10', 'percentage', 10, 15000, 5000, 1000],
      ['DELIVERY5000', 'fixed', 5000, 25000, null, 500],
      ['SUMMER20', 'percentage', 20, 30000, 10000, 200],
    ];
    const couponIds: Record<string, string> = {};
    for (const [code, type, value, minOrder, maxDiscount, usageLimit] of coupons) {
      const row = await insert('public.coupons', {
        code,
        discount_type: type as string,
        discount_value: value as number,
        min_order_amount: minOrder as number,
        max_discount: maxDiscount as number | null,
        starts_at: daysAgoAt(30, 0),
        expires_at: daysAgoAt(-60, 23),
        usage_limit: usageLimit as number,
        is_active: true,
      });
      couponIds[code as string] = row.id;
    }

    /* ------------------------ favorites -------------------------- */

    console.log('→ Дуртай ресторанууд...');
    await insert('public.favorites', {
      user_id: customers[0].id,
      restaurant_id: restaurants[0].id,
    });
    await insert('public.favorites', {
      user_id: customers[0].id,
      restaurant_id: restaurants[2].id,
    });
    await insert('public.favorites', {
      user_id: customers[1].id,
      restaurant_id: restaurants[1].id,
    });

    /* -------------------------- orders --------------------------- */

    console.log('→ Захиалгууд...');
    const STATUS_FLOW = ['pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivering', 'delivered'];

    const statusForAge = (days: number): string => {
      if (days === 0) return pick(['pending', 'confirmed', 'preparing', 'ready']);
      if (days === 1) return pick(['picked_up', 'delivering', 'delivered', 'delivered']);
      const roll = rand();
      if (roll < 0.09) return 'cancelled';
      return 'delivered';
    };

    let orderCount = 0;
    for (let i = 0; i < 70; i += 1) {
      const days = i < 12 ? 0 : i < 20 ? 1 : int(2, 29);
      const customer = pick(customers);
      const restaurant = pick(restaurants);
      const created = daysAgoAt(days, int(10, 21), int(0, 59));
      const status = statusForAge(days);

      // 1-3 distinct products from this restaurant
      const pool2 = productIds.filter((p) => p.restaurantId === restaurant.id);
      const chosen: typeof pool2 = [];
      const amount = int(1, 3);
      while (chosen.length < amount && pool2.length) {
        const candidate = pick(pool2);
        if (!chosen.find((c) => c.id === candidate.id)) chosen.push(candidate);
      }

      const lines = chosen.map((product) => {
        const quantity = int(1, 2);
        return {
          product,
          quantity,
          total: product.price * quantity,
        };
      });

      const subtotal = lines.reduce((sum, line) => sum + line.total, 0);
      const useCoupon = subtotal >= 25000 && rand() < 0.25;
      const couponCode = useCoupon ? pick(Object.keys(couponIds)) : null;
      const discount = useCoupon ? Math.min(subtotal * 0.1, 5000) : 0;
      const deliveryFee = restaurant.delivery_fee;
      const total = Math.round(subtotal - discount + deliveryFee);

      const addressOptions = customerAddresses[customer.id] ?? [];
      const addressId = addressOptions.length ? pick(addressOptions) : null;

      const order = await insert('public.orders', {
        user_id: customer.id,
        restaurant_id: restaurant.id,
        address_id: addressId,
        status,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: discount,
        total_amount: total,
        customer_note: rand() < 0.25 ? pick(['Хаалганы хонхоо дарна уу', 'Савхинд хийж өгөөрэй', 'Хурдан хүргээрэй']) : null,
        created_at: created,
        updated_at: created,
      });
      orderCount += 1;

      for (const line of lines) {
        await insert('public.order_items', {
          order_id: order.id,
          product_id: line.product.id,
          product_name: line.product.name,
          quantity: line.quantity,
          unit_price: line.product.price,
          total_price: line.total,
          selected_options: JSON.stringify([]),
          special_instructions: null,
        });
      }

      if (couponCode) {
        await insert('public.coupon_usages', {
          coupon_id: couponIds[couponCode],
          user_id: customer.id,
          order_id: order.id,
          created_at: created,
        });
      }

      // status history
      const flow = status === 'cancelled' ? ['pending', 'cancelled'] : STATUS_FLOW.slice(0, STATUS_FLOW.indexOf(status) + 1);
      for (const [index, step] of flow.entries()) {
        const at = new Date(created.getTime() + index * 9 * 60 * 1000);
        await insert('public.order_status_history', {
          order_id: order.id,
          status: step,
          note: index === 0 ? 'Захиалга үүслээ' : null,
          created_at: at,
        });
      }

      // delivery
      const assignedDriver = ['picked_up', 'delivering', 'delivered'].includes(status)
        ? pick(drivers)
        : null;
      const deliveryStatus =
        status === 'delivered'
          ? 'delivered'
          : status === 'delivering'
            ? 'delivering'
            : status === 'picked_up'
              ? 'picked_up'
              : status === 'cancelled'
                ? 'cancelled'
                : assignedDriver
                  ? 'assigned'
                  : 'waiting';

      await insert('public.deliveries', {
        order_id: order.id,
        driver_id: assignedDriver?.id ?? null,
        status: deliveryStatus,
        picked_up_at: assignedDriver ? new Date(created.getTime() + 25 * 60 * 1000) : null,
        delivered_at:
          status === 'delivered' ? new Date(created.getTime() + 45 * 60 * 1000) : null,
        created_at: created,
      });

      // payment
      const paid = ['delivered', 'picked_up', 'delivering'].includes(status);
      await insert('public.payments', {
        order_id: order.id,
        user_id: customer.id,
        payment_method: pick(['cash', 'card', 'qpay']),
        payment_status: status === 'cancelled' ? 'refunded' : paid ? 'paid' : 'pending',
        amount: total,
        transaction_id: paid ? `MOCK-${String(order.order_number).padStart(6, '0')}` : null,
        paid_at: paid ? new Date(created.getTime() + 2 * 60 * 1000) : null,
        created_at: created,
      });

      // reviews
      if (status === 'delivered' && rand() < 0.55) {
        await insert('public.reviews', {
          user_id: customer.id,
          restaurant_id: restaurant.id,
          order_id: order.id,
          rating: rand() < 0.7 ? 5 : rand() < 0.6 ? 4 : 3,
          comment: pick(REVIEW_COMMENTS),
          created_at: new Date(created.getTime() + 90 * 60 * 1000),
        });
      }
    }

    await client.query('COMMIT');

    console.log('\n✓ Seed амжилттай дууслаа');
    console.log(`  • ${RESTAURANTS.length} ресторан, ${productIds.length} бүтээгдэхүүн`);
    console.log(`  • ${customers.length} хэрэглэгч, ${drivers.length} хүргэгч, ${orderCount} захиалга`);
    console.log('\n  Нэвтрэх мэдээлэл:');
    console.log('  ─ admin@delivery.mn    / Admin123!');
    console.log('  ─ customer@delivery.mn / Customer123!');
    console.log('  ─ driver@delivery.mn   / Driver123!\n');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    console.error('✗ Seed алдаа:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void main();
