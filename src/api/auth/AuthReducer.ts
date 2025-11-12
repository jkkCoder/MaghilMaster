import { produce } from 'immer';
import {
  CREDENTIALS_STORE,
  RESTAURANT_DETAIL_REQUEST,
  RESTAURANT_DETAIL_SUCCESS,
  RESTAURANT_DETAIL_FAILURE
} from './AuthConstants';
import { AuthActions } from './AuthActions';
import { AuthState, AutomatedSignInPayload, sectionDetailsInterface } from './AuthModels';

const initialAuthState: AuthState = {
  // Auth Credential
  credentials: null,
  currentRestaurantDetail: {
    id: '',
    name: '',
    branchName: '',
    address: '',
    city: '',
    country: '',
    vertical: '',
    rating: 0,
    cost: '',
    highChair: 0,
    dining: 0,
    takeAway: 0,
    onlineCheckin: 0,
    delivery: 0,
    parking: [],
    cards: [],
    pref: [],
    tableSection: [],
    safetyMeasures: [],
    workingHours: [],
    facilities: [],
    cuisine: [],
    maxCheckinWaitThreshold: 0,
    maxOfflineCheckin: 0,
    maxOnlineCheckin: 0,
    onlineOrder: 0,
    open: 0,
    redirectUrl: null,
    orderTypes: [],
    statusIds: [],
    digitalMenu: 0,
    itemSpecialName: [],
    orderManagement: 0,
    printKOT: 0,
    printReceipt: 0,
    paymentProvider: null,
    scheduledDelivery: 0,
    scheduledDeliveryCutOffTime: '',
    scheduledDeliveryDurationInDays: 0,
    disabledServices: null,
    cuisineDevices: new Map<string, string>(),
    branch: [],
    phoneNumber: '',
    locationDeliveryProviders: null,
    defaultPickUpETA: 0,
    gstNo: '',
    thirdParties: [],
    orderFlowDetails: null,
    media: [],
    sectionDetailsList: [],
    customerOrdersAutoAccept: 0,
    email: '',
    quickCheckIn: null,
    serviceTaxConfigured: false,
    taxToBeRemoved: false,
    additionalPrintSpace: 0,
    prepTimeInMins: null,
    kotFooter: null,
    pinBasedLogin: 0,
    preOrderLinks: [],
    openCustomization: false,
    uiFeatureFlags: null
  },

  // SignIn
  signedIn: false,
  signInLoading: false,
  signInMessage: '',


  //Report Url
  reportDetails: null,
  getReportsLoading: false,

  // SignUp
  signedUp: false,
  signUpLoading: false,
  signUpMessage: '',

  user: null,
  userID: null,

  // OTP
  otpVerficationLoading: false,
  otpVerifiedSuccess: false,
  getTopicSubscribed: false,
  // Mobile
  mobileVerficationLoading: false,
  mobileVerifiedSuccess: false,

  isNetworkDisabled:false,
  NetworkErrorMessage:'',
  isNetworkToastShown:false,
  appVersion: '',
  myTableViewSectionExists:false,

  fromLoginFlow: true,
  isFirstTimeDashboard: true,
  showPinModal: false,
  showLockPinModal: false,
  autoLoginData: {} as AutomatedSignInPayload,
  lightMode: false,

  restaurantDetailLoading: false,
  restaurantDetailFailMessage: '',
  modificationAccessError: false,
  sectionList: [],
  selectedSection: '',
  selectedSectionName: '',
  
};

export default function authReducer(
  state: AuthState = initialAuthState,
  action: AuthActions,
) {
  return produce(state, (draft) => {
    switch (action.type) {
      // Credential Reducer
      case CREDENTIALS_STORE:
        draft.credentials = action.payload;
        draft.signedIn = true;
        draft.credentials.isSuperAdminAccess=action.payload.isSuperAdminAccess
        break;

      case RESTAURANT_DETAIL_REQUEST:
        draft.restaurantDetailLoading = true;
        draft.modificationAccessError = false;
        draft.sectionList = [];
        break;

      case RESTAURANT_DETAIL_SUCCESS:
        draft.restaurantDetailLoading = false;
        draft.currentRestaurantDetail = {
          ...action.payload,
        };
        
        draft.sectionList = action.payload.sectionDetailsList?.filter((section: sectionDetailsInterface) => section.isEnabled === 1);
        draft.selectedSectionName = draft.sectionList.length > 0 ? draft.sectionList[0].sectionName : '';
        draft.selectedSection = draft.sectionList.length > 0 ? draft.sectionList[0].id : '';
        break;

      case RESTAURANT_DETAIL_FAILURE:
        draft.restaurantDetailLoading = false;
        draft.restaurantDetailFailMessage = action.payload.message;
        break;
      
      default:
        break;
    }
  });
}
