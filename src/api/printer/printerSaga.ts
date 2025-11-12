import { MerchantDevice} from './printerModels';
import {AxiosResponse} from 'axios';
import {put, call, throttle} from 'redux-saga/effects';
import {
  failedGetPrinters,
  PrinterActions,
  successGetPrinters,
} from './printerActions';

import {
  getPrintersAPI,
} from './printerAPI';
import {
  GET_PRINTERS_REQUEST,
} from './printerConstants';

function* getPrinterSaga(action: PrinterActions) {
  try {
    const staffId = '2a6bea8d-ae9f-4c47-90c4-70b73a53f1ca'
    const response: AxiosResponse = yield call(getPrintersAPI,action.payload.locationId as string, action.payload.deviceIdentifier, action.payload.type);
    console.log("response ", response)
    if (response.status === 200) {
      let printers = response?.data?.body ?? response?.data;

      if (action.payload.deviceIdentifier) {
        const defaultDevice = printers?.find((device: MerchantDevice) => {
          return device?.deviceType == 'TAB' && device?.deviceIdentifier === action.payload.deviceIdentifier;
        });

        if (defaultDevice) {
          // Process receipt printers to set isDefault based on defaultDevice.receiptPrinterId
          printers = printers.map((printer: MerchantDevice) => {
            if (printer?.deviceType === 'PRINTER' && printer?.printTo !== 'ORDER') {
              return {
                ...printer,
                isDefault: (printer.id === defaultDevice?.receiptPrinterId) ? 1 : 0
              };
            }
            return printer;
          });
          
          const isDefault = defaultDevice?.isDefault === 1;
        }
      }
      
      // Save printers to WatermelonDB for offline access
      try {
        const { savePrintersToDB } = require('../../utils/printerWatermelonDBUtils');
        console.log('🖨️ Number of printers:', printers.length);
        
        yield call(savePrintersToDB, printers, action.payload.locationId, staffId);
      } catch (dbError) {
        console.error('❌ Failed to save printers to WatermelonDB:', dbError);
        // Continue execution even if WatermelonDB save fails
      }
      
      yield put(successGetPrinters(printers));
    } else {
      yield put(failedGetPrinters());
    }
    if (action.payload?.sagaResponseCB && typeof action.payload.sagaResponseCB === 'function') {
      action.payload?.sagaResponseCB(response?.data?.body ?? response?.data);
    }
  } catch (err) {
    yield put(failedGetPrinters());
    if (action.payload?.sagaResponseCB && typeof action.payload.sagaResponseCB === 'function') {
      action.payload?.sagaResponseCB([]);
    }
  }
}

export default function* printerSaga() {
  yield throttle(1000, GET_PRINTERS_REQUEST, getPrinterSaga);
}
