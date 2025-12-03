import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import StaffModel from '../models/staff/Staff';
import { getState } from '../../features/getStore';

/**
 * Validates a staff PIN by querying the local database
 * @param devicePin - The 4-digit PIN to validate
 * @param merchantId - Optional merchant ID. If not provided, will try to get from restaurant detail
 * @param locationId - Optional location ID as fallback for merchant ID
 * @returns Promise with staff model if found and active, null otherwise
 */
export const validateStaffPinFromDatabase = async (
  devicePin: string,
  merchantId?: string | null,
  locationId?: string | null
): Promise<StaffModel | null> => {
  try {
    // Get merchant_id from restaurant detail or use provided values
    const restaurantDetail = (getState() as any)?.restaurant?.currentRestaurantDetail;
    const finalMerchantId = merchantId || restaurantDetail?.merchantId || locationId;
    
    if (!finalMerchantId) {
      console.log('Error: Merchant ID not available');
      return null;
    }

    if (!devicePin || devicePin.length !== 4) {
      console.log('Error: Invalid PIN format');
      return null;
    }

    const staffCollection = database.collections.get<StaffModel>('mh_staff');
    
    // Query by devicePin and merchant_id
    const staffList = await staffCollection
      .query(
        Q.where('device_pin', devicePin),
        Q.where('merchant_id', finalMerchantId)
      )
      .fetch();
    console.log('staffList', staffList);
    if (staffList.length === 0) {
      return null;
    }

    const staff = staffList[0];
    
    // Check if staff is active (statusId check)
    if (!staff.statusId) {
      return null;
    }

    return staff;
  } catch (error) {
    console.log('Error validating pin from database:', error);
    return null;
  }
};
