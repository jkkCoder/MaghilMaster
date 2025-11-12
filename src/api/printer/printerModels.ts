export interface PrinterState {
  printers: MerchantDevice[];
  currentDevice: MerchantDevice | null;

  printersLoading: boolean;
  printersSuccess: boolean;
  printersFailure: boolean;

  printerUpdateLoading: boolean;
  printerUpdateSuccess: boolean;
  printerUpdateFailed: boolean;

  printerSyncTypes: string[];
  failedPrinterIPs: string[];

  digitalPrintersLoading: boolean,
  digitalPrintersSuccess: boolean,
  digitalPrintersFailure: boolean,

  defaultDevice: MerchantDevice | null;
  hasDefaultReceiptPrinter: boolean;
}

const printerTypes = ['ORDER', 'RECEIPT'] as const;

export type PrintToType = typeof printerTypes[number];

export interface MerchantDevice {
  id?: string;
  deviceIdentifier: string | ''; // MAC
  macAddress?: string | null; // MAC
  deviceType?: 'PRINTER' | 'TAB' | 'PAYMENT' | 'DISPLAY' | 'UNKNOWN';
  merchantId?: string | null;
  modelName?: string | null;
  locationId?: string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
  isDefault?: number | null;
  printTo?: PrintToType | null; // 'ORDER'
  printerPort?: string | null;
  tagIds?: Array<string>;
  isStarPrinter?: number;
  deviceConnectivityType?: number;
  is58mm?: boolean;
  receiptPrinterId?: string; // device level - each printer id only for RECEIPT
  sagaResponseCB?:(status:boolean)=>void;
}

export interface StarPrinter {
  modelName: string;
  macAddress: string;
  portName: string;
}
export interface DigitalPrinter {
  orderId?: string;
  name: string;
  mobile: string;
  email: string;
  splitId?: string;
  staffId: string;
  failureCB?: () => void
}

export interface PrinterPayloadInterface {
  deviceId: string;
  sagaResponseCB?: (status:boolean) => void
}

export interface PrinterFetchPayloadInterface {
  locationId: string;
  deviceIdentifier?: string;
  type?: string;
  sagaResponseCB?: (status: any) => void
}
export interface NearbyDevices {
  name: string;
  address: string;
  vendorId?: string;
  productId?: string;
}

// V2 API Models - request
export interface PrinterV2Model {
  deviceId?: string; // optional for new printers, required for updates
  merchantId: string;
  locationId: string;
  tabIdentifier?: string; // Tab/mobile device identifier.
  tagIds: string[];
  deviceIdentifier: string;
  deviceName: string;
  deviceIp: string;
  deviceType: 'PRINTER' | 'TAB' | 'PAYMENT' | 'DISPLAY' | 'UNKNOWN';
  model: string;
  isDefault: number;
  attributes: PrinterV2Attribute[];
  isStarPrinter?: number;
  is58mm?: boolean;
}

export interface PrinterV2Attribute {
  name: string;
  params: PrinterV2Params;
}

export interface PrinterV2Params {
  is58mm: boolean;
  isActiveDND?: boolean;
  isStarPrinter: number;
  printerPort?: string;
  deviceConnectivityType?: number;
  printTo?: PrintToType;
  isPrintToUpdate?: boolean;
}

export interface PrinterV2Request {
    printers: PrinterV2Model[];
    sagaResponseCB?: (status: boolean) => void; // only for requests
}

export interface PrinterV2FetchPayloadInterface {
  locationId: string;
  type: string;
}