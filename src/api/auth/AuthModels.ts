// Reducer State Type

export interface AuthState {
  reportDetails: any;

  credentials: Credentials | null,
  getTopicSubscribed: boolean,
  signedIn: boolean,
  signInLoading: boolean,
  signInMessage: string,

  signedUp: boolean,
  signUpLoading: boolean,
  signUpMessage: string,

  user: UserDetails | null,
  userID: string | null,


  otpVerficationLoading: boolean,
  otpVerifiedSuccess: boolean,

  mobileVerficationLoading: boolean,
  mobileVerifiedSuccess: boolean,

  isNetworkDisabled:boolean,
  isNetworkToastShown:boolean,
  NetworkErrorMessage:string,
  appVersion: string

  fromLoginFlow: boolean;
  isFirstTimeDashboard: boolean
  showPinModal: boolean;
  showLockPinModal: boolean;
  autoLoginData?: AutomatedSignInPayload;
  lightMode?:boolean;

  restaurantDetailLoading: boolean,
  restaurantDetailFailMessage: string,
  modificationAccessError: boolean;
  sectionList: sectionDetailsInterface[]
  currentRestaurantDetail: RestaurantDetail;
  selectedSection: string,
  selectedSectionName: string,

}


export const responseCodeTypes = [
  "ERROR",
  "SUCCESS"
] as const;


export interface MetaDataInfo {
  totalCount: number,
  totalPages: number,
  currentPageIndex: number,
  pageSize: number,
  currentPageSize: number,
  hasMore: boolean,
  sort: string,
  responseCode: typeof responseCodeTypes[number],
  responseMessage: string,
  data: Credentials
}


export interface MetaResult {
  metaDataInfo: MetaDataInfo,
  content: null
}


// SignUp
export interface SignUpForm {
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
  mobilePhone: string,
}

export interface SignUpData {
  name: string,
  email: string,
  password: string,
  confirmPassword: string,
  mobilePhone: string,
}

// SignIn
export interface SignInForm {
  email: string,
  password: string
}

export interface UserDetails {
  fullName: string,
  email: string,
  accessToken: string,
  refreshToken: string,
  isEmailVerified: boolean,
  authUserId: string
}

export interface MessageResult {
  message: string;
}


export interface Credentials {
  id: string, // Staff ID
  merchantId: string,
  locationId: string | null,
  businessName: string,
  email: string | null,
  userId: string,
  fullName: string,
  password: string | null,
  mobileNumber: string | null,
  authUserId: string | null,
  devicePin: string | null,
  accessToken: string,
  refreshToken: string,
  deviceIdentifier: string | null,
  deviceType: string | null,
  isSuperAdminAccess:boolean,
  myTableViewSectionExists:boolean,
  topicToSubscribe:string,
  userAccess: UserAccess
}

export interface UserAccess {
  removeCartItem: boolean,
  reservationConfig: boolean
}

// Mobile
export interface MobileVerificationDetails {
  fullName: string,
  mobilePhone: string
}

export interface MobileVerificationResult {
  userID: string
}


// OTP
export interface OTPVerificationDetails {
  fullName: string,
  mobilePhone: string,
  otp: string
}

export interface OTPVerificationResult {
  userID: string
}

export interface ReportUrl{
  reportDetails: string,
  getReportsLoading:string
}

//REPORT REQUEST
export interface ReportDetails {
  locationId: string,
  reportId: string,
  merchantId:string
}

export interface networkUpdate {
  NetworkDisabled: boolean,
  NetworkErrorMessage: string,
}


export interface AutomatedSignInPayload {
  businessName: string;
  password: string;
  userId: string;
  locationId: string,
  deviceIdentifier: string,
  merchantId: string,
}

export interface RestaurantDetailRequest {
  locationId?: string;
  staffId?:string;
  sendMyTableSection?:boolean;
}

export interface RestaurantDetailRequest {
  locationId?: string;
  staffId?:string;
  sendMyTableSection?:boolean;
}

export interface RestaurantState {
  currentRestaurantDetail: RestaurantDetail;
  restaurantDetailLoading: Boolean;
  restaurantDetailFailMessage: string;
  modificationLoading: Boolean;
  modificationError: String;
  isModified: Boolean;
  modificationAccessError: Boolean;
  tableSectionLoading: Boolean;
  tableSectionLoadingError: String;
  tableSectionLoaded: Boolean;
  tableSectionDetails: TableSectionDetails;
  selectedSection: string;
  selectedSectionName: string;
  isHappyHour:boolean;
  sectionList: sectionDetailsInterface[];
  isReservationAvailable: boolean;
  locationHoursLoading: boolean;
  locationHours: LocationHoursPayload
  locationHoursUpdateLoading: boolean;
}

export interface TableSectionDetails {
  tableDetails: Array<RestaurantTableDetail>;
  sectionDetails: Array<Section>;
}

export interface RestaurantTableDetail {
  tableId: string;
  merchantLocationId: string;
  sectionId: string;
  sectionName: string;
  tableName: string;
  minCapacity: number;
  maxCapacity: number;
  tableEnabled: number;
  sectionEnabled: number;
}

export interface Section {
  id?: string;
  sectionName: string;
  isEnabled?: boolean;
  sectionId?:string;
}

export interface LocationHoursPayload {
  locationId?: string;
  pickUpETATime?: string;
  deliveryETATime?: string;
  locationHoursInfo: GroupedOutput[],
  existingLocationHoursInfo?:  GroupedOutput[],
  sagaCB?: (status: boolean) => void;
}

export interface sectionDetailsInterface {
  id: string;
  sectionName: string;
  isEnabled: number;
}

export interface GroupedOutput {
  weekDays: string[];
  isBe?: boolean;
  uniqueId?: string;
  isDelete?: boolean;
  isClosed: boolean;
  slots: DaySlot[];
};

export interface DaySlot {
  openTime: string;
  closeTime: string;
  isDelete?: boolean;
};

export interface Branch {
  id: string;
  locationName: string;
  rating: number;
  latitude: number;
  longitude: number;
  orderTypes: OrderType[];
  cusine: Array<string>;
}

const orderTypeGroupTypes = ['D', 'P', 'S', 'I','A','O', 'None'] as const;

export type OrderTypeGroupType = typeof orderTypeGroupTypes[number];

export interface orderTax {
  orderTypeId: string;
  type: string;
  name: string;
  rate: number;
}

export interface OrderType {
  id: string;
  typeName: string;
  isEnabled: number;
  isNotHide: number;
  typeGroup: OrderTypeGroupType;
  orderTax?: orderTax | null;
  statusId?: string[];
  price?: string;
  typeId?: string;
  availabilityEnabled?: boolean;
  isShowDropdown?: boolean;
  isShowSessionsDropdown?: boolean;
  isShowDatePicker?: boolean;
  isShowTimePicker?: boolean;
  selectedDropdownValue?: string;
}

export interface Cuisine {
  id: string;
  tagName: string;
}

export interface RestaurantWorkingHours {
  locationId: string
  weekday: string
  openingTime: string
  closingTime: string
  onlineCutoff: string
  pickupCutoff: string
  dayValue: number
}
export interface ItemSpecial {
  id: string;
  name: string;
}

export interface DeliveryProvider {
  deliveryProviderId: string;
  locationId: string;
  attributes: null;
  is_default: boolean;
  createdTime: string;
  modifiedTime: string | null;
}

const paymentProviderIdTypes = [
  'RAZORPAY_AGGREGATOR',
  'FIRSTDATA_AGGREGATOR',
  'HEARTLAND_AGGREGATOR',
] as const;


export type PaymentProviderIdType = typeof paymentProviderIdTypes[number];


export interface PaymentProvider {
  paymentServiceProviderId: PaymentProviderIdType;
  locationId: string;
  paymentProviderId: string;
  classData: PaymentProviderClassData;
}

export interface PaymentProviderClassData {
  paymentOptions: string[]; // [CNP_MERCHANT,CNP_CUSTOMER,CP,PAYMENT_LINKS,BHARAT_QR];
  paymentParties: PaymentParty[];
  terminalNo: string | null;
  userName:string | null;
  excludeTip:string | null
  dataCapMerchantId:string | null
}

export interface PaymentParty {
  partyId: string;
  holdUntil: number;
  partyName: string;
  partyType: string; // "MERCHANT"
  partyAddress: string;
  paymentPartyRate: number;
  partyAccountNumber: string;
  paymentPartyFeeType: string; // "PERCENT"
  terminalNo: string;
}


export interface disabledServices {
  sms: number | null;
  onlineOrder: number | null;
  onlineCheckIn: number | null;
  email: number,
  whatsappSms: number,
  checkInWhatsapp: number,
  isReservation: number|null,
}

export interface OrderFlow {
  orderTypeId: string;
  statusIds: string[];
}
export interface Media {
  id: string;
  entityType: string;
  mimeType: string;
}

export interface Coins {
    symbol: string;
    value: string
}

export interface PreOrderLinks {
  eventName : string,
  eventSlug : string,
  text: string,
  link: string,
  colour: string
}

export enum DiscountType {
  Percent = 'percent',
  FlatFee = 'flatFee',
}

export interface Discount {
  name: string;
  rate: number;
  type: DiscountType;
}

export interface NotesProps {
  itemNotes: [],
  orderNotes: []
}

export interface UtilityObjects {
  cancelReasons: any,
  notes: NotesProps
}

export interface RestaurantDetail {
  customerOrdersAutoAccept: number;
  id: string;
  name: string;
  branchName: string;
  branch: Branch[];
  address: string;
  phoneNumber: string;
  city: string;
  country: string;
  vertical?: string;
  rating: number;
  open: number;
  cost: string; // 200-2
  highChair: number; // 1
  gstNo: string;
  email:string;
  dining: number; // 1
  takeAway: number; // 0
  digitalMenu: number;
  onlineCheckin: number;
  onlineOrder: number;
  delivery: number;
  orderManagement: number;
  defaultPickUpETA: number;
  printKOT: number;
  printReceipt: number;
  parking: Array<string>;
  cards: Array<string>;
  pref: Array<string>;
  tableSection: Array<Section>;
  safetyMeasures: Array<string>;
  workingHours: Array<RestaurantWorkingHours>;
  facilities: Array<string>;
  cuisine: Array<Cuisine>;
  maxOnlineCheckin: number;
  kidsCount: number;
  maxOfflineCheckin: number;
  maxCheckinWaitThreshold: number;
  redirectUrl: string | null;
  orderTypes: OrderType[] | null;
  statusIds: Array<string>;
  itemSpecialName: ItemSpecial[] | null;
  locationDeliveryProviders: DeliveryProvider | null;
  // Payments
  paymentProvider: PaymentProvider | null;

  //Scheduled delivery
  scheduledDelivery: number;
  scheduledDeliveryCutOffTime: string;
  scheduledDeliveryDurationInDays: number;

  disabledServices: disabledServices | null;
  quickCheckIn : number | null;
  cuisineDevices: Map<string, string> | null;
  thirdParties?: string[];
  orderFlowDetails: OrderFlow[] | null;
  media: Array<Media>;
  defaultTax?: orderTax | null;
  isMasterLocation?: number;
  customerAppAutoAccept?: number;
  assignTableDuringQuickCheckIn?:number;
  serviceTaxConfigured:boolean;
  taxToBeRemoved:boolean;
  sectionDetailsList:sectionDetailsInterface[];
  additionalPrintSpace:number;
  imageRequired?: boolean;
  prepTimeInMins:string | null ;
  dataCapCnpPayment?:boolean;
  kotFooter:string|null;
  cashDiscount?:boolean;
  cashDiscountOffer?:any;
  coins: Coins[];
  notes: Coins[];

  isSurchargeEnabled?: boolean
  isQSRDineInEnabled?:boolean
  customizationCountRequired?: boolean
  pinBasedLogin:number;
  receiptFooter:string|null;
  isInQueueSectionEnabled?: boolean,
  preOrderLinks: PreOrderLinks[],
  timeZoneCd:string
  preAuthPaymentEnable?:boolean;
  showMenuPrice?: boolean;
  userAccess:any;
  discounts?: Discount[];
  utilities: UtilityObjects;
  openCustomization?: boolean;
  enabledModules?: EnabledModule[];
  maxReservationDayCount?: string;
  specialRequests?: string[];
  minOnlineCheckin?: number;
  theme: Theme|any,
  uiFeatureFlags: any | null,
}

export interface ModuleItem {
  id: string;
  moduleName: string;
  brandName: string | null;
  isEnabled: boolean;
  isStandalone: boolean;
}

export interface EnabledModule {
  brandName: string;
  modules: ModuleItem[];
}

export interface Theme{
  kotAligment:string,
  kotFont:string,
}

export interface RestaurantDetailFailResult {
  message: string;
}