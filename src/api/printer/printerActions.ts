import {typedAction} from '../actionTypes';
import {
  GET_PRINTERS_FAILURE,
  GET_PRINTERS_REQUEST,
  GET_PRINTERS_SUCCESS,
  GET_PRINTERS_CLEAR,
} from './printerConstants';
import { MerchantDevice, PrinterFetchPayloadInterface, } from './printerModels';

// Update Order
export function getPrinters(data: PrinterFetchPayloadInterface) {
  return typedAction(GET_PRINTERS_REQUEST, data);
}

export function failedGetPrinters() {
  return typedAction(GET_PRINTERS_FAILURE, '');
}

export function successGetPrinters(printers: MerchantDevice[], currentDevice?: MerchantDevice, hasDefaultReceiptPrinter?: boolean) {
  return typedAction(GET_PRINTERS_SUCCESS, { printers, currentDevice, hasDefaultReceiptPrinter });
}

export function clearGetPrinters() {
  return typedAction(GET_PRINTERS_CLEAR, '');
}


export type PrinterActions = ReturnType<
  | typeof getPrinters
  | typeof failedGetPrinters
  | typeof successGetPrinters
  | typeof clearGetPrinters
>;
