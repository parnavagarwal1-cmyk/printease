export interface BranchInfo {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
}

export interface ShopInfo {
  id: number;
  name: string;
  logo_url: string | null;
  currency: string;
}

export interface PricingRule {
  id: number;
  branch_id: number;
  paper_size: string;
  bw_single_price: string | number;
  bw_duplex_price: string | number;
  color_single_price: string | number;
  color_duplex_price: string | number;
  duplex_pricing_mode: string;
  min_order_amount: string | number;
  tax_rate_percent: string | number;
  is_active: boolean;
}

export interface PrinterCapability {
  id: number;
  name: string;
  capabilities: {
    supports_color: boolean;
    supports_duplex: boolean;
    supported_paper_sizes: string[];
  };
  status: string;
}

export interface QrResolutionResponse {
  qr_token: string;
  branch: BranchInfo;
  shop: ShopInfo;
  pricing_rules: PricingRule[];
  printers: PrinterCapability[];
}

export interface UploadedFileMeta {
  file_token: string;
  original_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  sha256_checksum: string;
  page_count: number;
}

export interface PricingBreakdown {
  currency: string;
  items: Array<{
    item_index: number;
    paper_size: string;
    color_mode: string;
    duplex_mode: string;
    copies: number;
    total_document_pages: number;
    page_range: string;
    effective_page_count: number;
    sheets_per_copy: number;
    total_sheets: number;
    unit_price: number;
    subtotal: number;
  }>;
  subtotal: number;
  min_order_amount: number;
  min_order_adjustment: number;
  tax_rate_percent: number;
  tax_amount: number;
  total_amount: number;
  branch: {
    id: number;
    name: string;
    shop_name: string;
  };
}

export interface CreatedOrder {
  id: number;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  status: string;
  subtotal_amount: string | number;
  tax_amount: string | number;
  total_amount: string | number;
  created_at: string;
}
