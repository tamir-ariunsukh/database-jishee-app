-- ============================================================
--  Delivery App — PostgreSQL schema
--  Source: database.txt (Supabase-style schema)
--  auth.users is a local shim: in Supabase it is managed by GoTrue,
--  here we own it (email + password_hash + role).
-- ============================================================

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'customer'
                CHECK (role IN ('customer', 'admin', 'driver')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ------------------------- public schema -------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL,
  full_name text,
  phone text UNIQUE,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  title text,
  address text NOT NULL,
  latitude numeric,
  longitude numeric,
  apartment text,
  entrance text,
  floor text,
  is_default boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT addresses_pkey PRIMARY KEY (id),
  CONSTRAINT addresses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.restaurants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  logo_url text,
  cover_url text,
  phone text,
  address text,
  latitude numeric,
  longitude numeric,
  delivery_fee numeric DEFAULT 0,
  min_order_amount numeric DEFAULT 0,
  estimated_delivery_minutes integer,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT restaurants_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  image_url text,
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  category_id uuid,
  name text NOT NULL,
  description text,
  image_url text,
  price numeric NOT NULL CHECK (price >= 0::numeric),
  discount_price numeric,
  is_available boolean DEFAULT true,
  preparation_minutes integer,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.product_option_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  name text NOT NULL,
  required boolean DEFAULT false,
  min_select integer DEFAULT 0,
  max_select integer DEFAULT 1,
  CONSTRAINT product_option_groups_pkey PRIMARY KEY (id),
  CONSTRAINT product_option_groups_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.product_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  group_id uuid,
  name text NOT NULL,
  additional_price numeric DEFAULT 0,
  CONSTRAINT product_options_pkey PRIMARY KEY (id),
  CONSTRAINT product_options_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.product_option_groups(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.carts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,
  restaurant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT carts_pkey PRIMARY KEY (id),
  CONSTRAINT carts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT carts_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  cart_id uuid,
  product_id uuid,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  special_instructions text,
  CONSTRAINT cart_items_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_cart_id_fkey FOREIGN KEY (cart_id) REFERENCES public.carts(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_number bigint GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  user_id uuid,
  restaurant_id uuid,
  address_id uuid,
  status text NOT NULL DEFAULT 'pending'::text CHECK (status = ANY (ARRAY['pending'::text, 'confirmed'::text, 'preparing'::text, 'ready'::text, 'picked_up'::text, 'delivering'::text, 'delivered'::text, 'cancelled'::text])),
  subtotal numeric NOT NULL DEFAULT 0,
  delivery_fee numeric DEFAULT 0,
  discount_amount numeric DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  customer_note text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT orders_pkey PRIMARY KEY (id),
  CONSTRAINT orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT orders_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL,
  CONSTRAINT orders_address_id_fkey FOREIGN KEY (address_id) REFERENCES public.addresses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  product_id uuid,
  product_name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  selected_options jsonb DEFAULT '[]'::jsonb,
  special_instructions text,
  CONSTRAINT order_items_pkey PRIMARY KEY (id),
  CONSTRAINT order_items_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  user_id uuid,
  payment_method text NOT NULL,
  payment_status text DEFAULT 'pending'::text CHECK (payment_status = ANY (ARRAY['pending'::text, 'paid'::text, 'failed'::text, 'refunded'::text])),
  amount numeric NOT NULL,
  transaction_id text,
  paid_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.drivers (
  id uuid NOT NULL,
  full_name text,
  phone text,
  is_available boolean DEFAULT true,
  latitude numeric,
  longitude numeric,
  CONSTRAINT drivers_pkey PRIMARY KEY (id),
  CONSTRAINT drivers_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.deliveries (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid UNIQUE,
  driver_id uuid,
  status text DEFAULT 'waiting'::text,
  picked_up_at timestamp with time zone,
  delivered_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT deliveries_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE,
  CONSTRAINT deliveries_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES public.drivers(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  order_id uuid,
  status text NOT NULL,
  note text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT order_status_history_pkey PRIMARY KEY (id),
  CONSTRAINT order_status_history_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  restaurant_id uuid,
  order_id uuid UNIQUE,
  rating integer CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reviews_pkey PRIMARY KEY (id),
  CONSTRAINT reviews_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT reviews_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT reviews_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_type text CHECK (discount_type = ANY (ARRAY['percentage'::text, 'fixed'::text])),
  discount_value numeric NOT NULL,
  min_order_amount numeric DEFAULT 0,
  max_discount numeric,
  starts_at timestamp with time zone,
  expires_at timestamp with time zone,
  usage_limit integer,
  is_active boolean DEFAULT true,
  CONSTRAINT coupons_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  coupon_id uuid,
  user_id uuid,
  order_id uuid UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT coupon_usages_pkey PRIMARY KEY (id),
  CONSTRAINT coupon_usages_coupon_id_fkey FOREIGN KEY (coupon_id) REFERENCES public.coupons(id) ON DELETE CASCADE,
  CONSTRAINT coupon_usages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT coupon_usages_order_id_fkey FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.favorites (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  restaurant_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT favorites_pkey PRIMARY KEY (id),
  CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT favorites_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT favorites_user_restaurant_uniq UNIQUE (user_id, restaurant_id)
);

CREATE TABLE IF NOT EXISTS public.restaurant_hours (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time without time zone,
  close_time time without time zone,
  is_closed boolean DEFAULT false,
  CONSTRAINT restaurant_hours_pkey PRIMARY KEY (id),
  CONSTRAINT restaurant_hours_restaurant_id_fkey FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE,
  CONSTRAINT restaurant_hours_uniq UNIQUE (restaurant_id, day_of_week)
);

-- ------------------------- helpers -------------------------

-- Additions on top of the original record (database.txt):
-- a cart line must remember the selected option set so the price can be
-- recalculated and copied into order_items.selected_options.
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS selected_options jsonb NOT NULL DEFAULT '[]'::jsonb;

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS orders_set_updated_at ON public.orders;
CREATE TRIGGER orders_set_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW public.restaurant_ratings AS
SELECT r.id AS restaurant_id,
       COALESCE(ROUND(AVG(rv.rating)::numeric, 1), 0) AS avg_rating,
       COUNT(rv.id) AS review_count
FROM public.restaurants r
LEFT JOIN public.reviews rv ON rv.restaurant_id = r.id
GROUP BY r.id;

-- ------------------------- indexes -------------------------

CREATE INDEX IF NOT EXISTS products_restaurant_idx ON public.products (restaurant_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON public.products (category_id);
CREATE INDEX IF NOT EXISTS orders_user_idx ON public.orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_restaurant_idx ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders (status);
CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS cart_items_cart_idx ON public.cart_items (cart_id);
CREATE INDEX IF NOT EXISTS addresses_user_idx ON public.addresses (user_id);
CREATE INDEX IF NOT EXISTS reviews_restaurant_idx ON public.reviews (restaurant_id);
CREATE INDEX IF NOT EXISTS deliveries_driver_idx ON public.deliveries (driver_id);
