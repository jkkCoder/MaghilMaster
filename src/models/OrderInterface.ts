export interface OrderJSON {
    id: string;
    location_id: string;
    customer_id?: string | null;
    customer_fullname?: string | null;
    customer_phone_number?: string | null;
    customer_email?: string | null;
    address_id?: string | null;
    device_id?: string | null;
    staff_id?: string | null;
    comment?: string | null;
    order_no: string;
    order_type_id: string;
    order_date: string; // ISO date string
    order_time?: string | null; // ISO time string
    is_service_charge_removed?: number;
    is_tax_removed?: number;
    pickup_date?: string | null;
    pickup_time?: string | null;
    eta_date?: string | null;
    eta_time?: string | null;
    event_time?: string | null;
    created_time?: string | null;
    order_source_detail?: any | null; // JSON object
    ip_address: string;
    user_agent: string;
    section_id?: string | null;
    statuses?: OrderStatusJSON[];
    totals?: OrderTotalJSON[];
    items?: OrderItemJSON[];
    transactions?: TransactionJSON[];
}

export interface OrderStatusJSON {
    id: string;
    order_id: string;
    status: number;
    event_time?: string | null;
    created_time?: string | null;
    updated_by: string;
}

export interface OrderTotalJSON {
    id: string;
    order_id: string;
    code: number;
    title: string;
    value: number;
    sort_order: number;
    event_time?: string | null;
    created_time?: string | null;
}

export interface OrderItemJSON {
    id: string;
    order_id: string;
    item_id: string;
    device_id: string;
    staff_id: string;
    item_name?: string | null;
    price?: number | null;
    discount_fee_type: string;
    discount_fee_rate: number;
    quantity: number;
    comment?: string | null;
    event_time?: string | null;
    created_time?: string | null;
    options?: OrderItemOptionJSON[];
}

export interface OrderItemOptionJSON {
    id: string;
    order_item_id: string;
    order_id: string;
    modifier_option_id?: string | null;
    option_name: string;
    quantity: number;
    price?: number | null;
    sort_order?: number | null;
    event_time?: string | null;
    created_time?: string | null;
}

export interface TransactionJSON {
    id: string;
    order_id: string;
    location_id: string;
    payment_provider_id: string;
    message: string;
    request: string | null; // JSON stored as string, can be null
    status_code: string;
    transaction_amount: number;
    tender_type: string;
    cashDrawerDeviceId?: string | null;
    cashierLogId?: string | null;
    transaction_type: string | null;
    card_type?: string | null;
    card_last4?: string | null;
    card_name?: string | null;
}