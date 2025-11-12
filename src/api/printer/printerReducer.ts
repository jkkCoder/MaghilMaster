import {produce} from 'immer';
import {PrinterActions} from './printerActions';
import {
  GET_PRINTERS_CLEAR,
  GET_PRINTERS_FAILURE,
  GET_PRINTERS_REQUEST,
  GET_PRINTERS_SUCCESS,
} from './printerConstants';
import {PrinterState} from './printerModels';

const initialCartState: PrinterState = {
  printers: [],
  currentDevice:null,
  hasDefaultReceiptPrinter: false,
  printersLoading: false,
  printersSuccess: false,
  printersFailure: false,

  printerUpdateLoading: false,
  printerUpdateSuccess: false,
  printerUpdateFailed: false,

  digitalPrintersLoading: false,
  digitalPrintersSuccess: false,
  digitalPrintersFailure: false,

  printerSyncTypes: [],
  failedPrinterIPs: [],
  defaultDevice: null,
};

export default function printerReducer(
  state: PrinterState = initialCartState,
  action: PrinterActions,
) {
  return produce(state, (draft) => {
    switch (action.type) {
      case GET_PRINTERS_REQUEST:
        draft.printersLoading = true;
        break;
      case GET_PRINTERS_SUCCESS:
        draft.printers = action.payload.printers;
        draft.currentDevice = action.payload.currentDevice;
        draft.hasDefaultReceiptPrinter = action.payload.hasDefaultReceiptPrinter;
        draft.printersLoading = false;
        draft.printersSuccess = true;
        break;
      case GET_PRINTERS_FAILURE:
        draft.printersFailure = true;
        draft.printersLoading = false;
      case GET_PRINTERS_CLEAR:
        draft.printersSuccess = false;
        draft.printersFailure = false;
        draft.digitalPrintersSuccess = false;
        draft.digitalPrintersFailure = false;
        break;
      default:
        break;
    }
  });
}
