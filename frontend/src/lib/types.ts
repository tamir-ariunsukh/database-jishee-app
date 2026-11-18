export type Role = 'customer' | 'admin' | 'driver';

export interface User {
  id: string;
  email: string;
  role: Role;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at?: string;
}

export interface Category {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface Restaurant {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  delivery_fee: number;
  min_order_amount: number;
  estimated_delivery_minutes: number | null;
  is_active: boolean;
  created_at: string;
  avg_rating: number;
  review_count: number;
  hours?: RestaurantHour[];
  reviews?: Review[];
  rating_distribution?: { rating: number; count: number }[];
}

export interface RestaurantHour {
  id: string;
  restaurant_id: string;
  day_of_week: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  discount_price: number | null;
  is_available: boolean;
  preparation_minutes: number | null;
  created_at: string;
  restaurant_name?: string;
  category_name?: string | null;
}

export interface ProductOption {
  id: string;
  group_id: string;
  name: string;
  additional_price: number;
}

export interface OptionGroup {
  id: string;
  product_id: string;
  name: string;
  required: boolean;
  min_select: number;
  max_select: number;
  options: ProductOption[];
}

export interface SelectedOption {
  option_id: string;
  group_id?: string;
  group_name?: string;
  name: string;
  additional_price: number;
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  image_url: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
  special_instructions: string | null;
  selected_options: SelectedOption[];
  is_available: boolean;
}

export interface Cart {
  id: string | null;
  restaurant_id: string | null;
  restaurant_name: string | null;
  delivery_fee: number;
  min_order_amount: number;
  estimated_delivery_minutes?: number | null;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  total: number;
}

export interface Address {
  id: string;
  user_id: string;
  title: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  is_default: boolean;
  created_at: string;
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivering'
  | 'delivered'
  | 'cancelled';

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  selected_options: SelectedOption[];
  special_instructions: string | null;
}

export interface Payment {
  id: string;
  order_id: string;
  user_id: string | null;
  payment_method: string;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  amount: number;
  transaction_id: string | null;
  paid_at: string | null;
  created_at: string;
  order_number?: number;
  customer_name?: string | null;
}

export interface Delivery {
  id: string;
  order_id: string;
  driver_id: string | null;
  status: string;
  picked_up_at: string | null;
  delivered_at: string | null;
  created_at: string;
  order_number?: number;
  order_status?: OrderStatus;
  total_amount?: number;
  restaurant_name?: string | null;
  address_text?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
}

export interface Order {
  id: string;
  order_number: number;
  user_id: string | null;
  restaurant_id: string | null;
  address_id: string | null;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  discount_amount: number;
  total_amount: number;
  customer_note: string | null;
  created_at: string;
  updated_at: string;
  restaurant_name?: string | null;
  restaurant_logo_url?: string | null;
  estimated_delivery_minutes?: number | null;
  address_title?: string | null;
  address_text?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  floor?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  items?: OrderItem[];
  review_id?: string | null;
  status_history?: { id: string; status: string; note: string | null; created_at: string }[];
  delivery?: Delivery | null;
  payment?: Payment | null;
}

export interface Review {
  id: string;
  user_id: string | null;
  restaurant_id: string | null;
  order_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
  full_name?: string | null;
  avatar_url?: string | null;
  restaurant_name?: string | null;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount: number | null;
  starts_at: string | null;
  expires_at: string | null;
  usage_limit: number | null;
  is_active: boolean;
}

export interface Driver {
  id: string;
  full_name: string | null;
  phone: string | null;
  is_available: boolean;
  latitude: number | null;
  longitude: number | null;
  email: string;
  active_deliveries: number;
  completed_deliveries: number;
  created_at: string;
}

export interface AdminUser extends User {
  order_count: number;
  total_spent: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminStats {
  summary: {
    total_orders: number;
    orders_today: number;
    total_revenue: number;
    revenue_today: number;
    active_orders: number;
    total_customers: number;
    active_restaurants: number;
    total_drivers: number;
    avg_rating: number;
  };
  status_counts: { status: OrderStatus; count: number }[];
  revenue_series: { day: string; revenue: number; orders: number }[];
  top_restaurants: { id: string; name: string; logo_url: string | null; orders: number; revenue: number }[];
  top_products: { product_name: string; sold: number; revenue: number }[];
  recent_orders: {
    id: string;
    order_number: number;
    status: OrderStatus;
    total_amount: number;
    created_at: string;
    restaurant_name: string | null;
    customer_name: string | null;
  }[];
}
