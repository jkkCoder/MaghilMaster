import { database } from '../database';
import { RegisterLists, Coins, StartShiftPayload, LogShiftDetails, CureentLogShiftDetailsPayload, AddPayInPayload, ExpenseTransactionResponse, ExpenseTransactionLog, PayInTransactionPayload, CompleteShiftSummary, CompleteShiftSummaryPayload, PastCountList, PastShiftPayload, LogtDetails, expenseLogList } from '../../../features/cash/cashModel';
import VaultCashierLog from '../models/vaultCashDrawer/VaultCashierLog';
import VaultExpenseLog from '../models/vaultCashDrawer/VaultExpenseLog';
import { v4 as uuidv4 } from 'uuid';
import { getState } from '../../features/getStore';
import momentTz from 'moment-timezone';
import { Storage } from '../AppPrefStore';
import moment from 'moment';

/**
 * Get all cash drawers from offline database and convert to RegisterLists format
 * This ensures the data structure matches exactly what the Manage button expects
 */
export const getAllCashDrawersOffline = async (): Promise<RegisterLists[]> => {

  try {
    // Read from app_pref table instead of vault_cash_drawer table
    return await getCashDrawersFromAppPref();
  } catch (error) {
    console.error('Error fetching offline cash drawers from app_pref:', error);
    return [];
  }
};

/**
 * Format timestamp to match database format (using restaurant timezone with AM/PM)
 */
const formatTimestamp = (): string => {
  console.log('🔵 [formatTimestamp] Function called!');
  
  try {
    // Get restaurant timezone from store
    const restaurantDetails = getState()?.restaurant?.currentRestaurantDetail;
    console.log('🔵 [formatTimestamp] Restaurant details:', restaurantDetails ? 'Found' : 'Not found');
    
    const timeZone = restaurantDetails?.timeZoneCd || 'UTC'; // Fallback to UTC if not available
    
    // Debug logging
    console.log('🕐 [formatTimestamp] Restaurant timezone:', timeZone);
    console.log('🕐 [formatTimestamp] Device time:', new Date().toString());
    
    // Get current time in restaurant's timezone
    // Use momentTz() to get current time, then convert to restaurant timezone
    const now = momentTz().tz(timeZone);
    
    // Debug logging
    console.log('🕐 [formatTimestamp] Time in restaurant timezone:', now.format('YYYY-MM-DD HH:mm:ss A'));
    console.log('🕐 [formatTimestamp] UTC time:', momentTz().utc().format('YYYY-MM-DD HH:mm:ss A'));
    
    // Format: YYYY-MM-DD HH:mm:ss AM/PM
    const year = now.year();
    const month = String(now.month() + 1).padStart(2, '0');
    const day = String(now.date()).padStart(2, '0');
    
    let hours = now.hours();
    const minutes = String(now.minutes()).padStart(2, '0');
    const seconds = String(now.seconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12 for midnight
    const hoursStr = String(hours).padStart(2, '0');
    
    const formatted = `${year}-${month}-${day} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
    console.log('🕐 [formatTimestamp] Final formatted time:', formatted);
    
    return formatted;
  } catch (error) {
    console.error('❌ [formatTimestamp] Error occurred:', error);
    // Fallback to device local time if store is not available
    console.warn('⚠️ [vaultHelper] Could not get restaurant timezone, using device time:', error);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hoursStr}:${minutes}:${seconds} ${ampm}`;
  }
};

/**
 * Start shift offline - saves shift data to database
 * @param payload - Shift payload data
 * @param registerData - Optional register data (registerName, floatAmount, notes, coins) for creating cash drawer if it doesn't exist
 */
export const startShiftOffline = async (payload: StartShiftPayload, registerData?: { registerName?: string; floatAmount?: number; notes?: Coins[]; coins?: Coins[] }): Promise<string> => {
  console.log('🟢 [startShiftOffline] Function called!');
  console.log('🟢 [startShiftOffline] About to call formatTimestamp...');
  
  const currentTime = formatTimestamp();
  console.log('🟢 [startShiftOffline] Got currentTime:', currentTime);
  
  let createdLogId: string;
  
  await database.write(async () => {
    // Create cashier log record in WatermelonDB
    const createdLog = await database.collections
      .get<VaultCashierLog>('mh_cashier_log')
      .create((log) => {
        log.locationId = payload.locationId;
        log.cashDrawerDeviceId = payload.cashDrawerId;
        log.staffId = payload.staffId;
        log.amount = payload.amount.toString();
        log.statusId = 50; 
        log.parentId = null;
        log.floatAmt = payload.amount.toString();
        log.notes = payload.notes ? JSON.stringify(payload.notes) : null;
        log.coins = payload.coins ? JSON.stringify(payload.coins) : null;
        log.cheques = payload.cheques ? JSON.stringify(payload.cheques) : null;
        log.createdTime = currentTime;
        log.modifiedTime = currentTime;
        log.syncedAt = null;
      });
    createdLogId = createdLog.id;
  });

  // Update or create drawer in app_pref
  const drawers = await getCashDrawersFromAppPref();
  const existingDrawer = drawers.find(d => d.cashDrawerId === payload.cashDrawerId);
  
  if (existingDrawer) {
    // Update existing drawer with shift info
    await updateCashDrawerInAppPref(payload.cashDrawerId, {
      cashierLogId: createdLogId,
      currentBalance: payload.amount, // Set balance to shift starting amount
      modifiedTime: formatModifiedTime(),
    });
    console.log('✅ [startShiftOffline] Updated existing drawer in app_pref');
  } else {
    // Create new drawer if it doesn't exist (when starting shift)
    console.log('⚠️ [startShiftOffline] Drawer not found, creating new one...');
    await updateCashDrawerInAppPref(payload.cashDrawerId, {
      registerName: registerData?.registerName || 'Register',
      floatAmount: registerData?.floatAmount ?? payload.amount,
      currentBalance: payload.amount, // Starting balance = shift amount
      cashierLogId: createdLogId,
      modifiedTime: formatModifiedTime(),
      notes: registerData?.notes || [],
      coins: registerData?.coins || [],
    });
    console.log('✅ [startShiftOffline] Created new drawer in app_pref');
  }

  return createdLogId;
};

/**
 * Complete shift offline - updates shift status
 */
export const completeShiftOffline = async (payload: StartShiftPayload): Promise<void> => {
  if (!payload.cashierLogId) {
    throw new Error('cashierLogId is required for completing shift');
  }

  const currentTime = formatTimestamp();

  await database.write(async () => {
    // Find and update cashier log
    const cashierLogs = await database.collections
      .get<VaultCashierLog>('mh_cashier_log')
      .query()
      .fetch();

    const cashierLog = cashierLogs.find(l => l.id === payload.cashierLogId);

    if (cashierLog) {

      const updateData = {
        amount: payload.amount.toString(),
        statusId: 51,
        parentId: payload.cashierLogId,
        cheques: payload.cheques ? JSON.stringify(payload.cheques) : null,
        notes: payload.notes ? JSON.stringify(payload.notes) : null,
        coins: payload.coins ? JSON.stringify(payload.coins) : null,
        modifiedTime: currentTime,
      };
      await cashierLog.update((log) => {
        log.amount = payload.amount.toString();
        log.statusId = 51; 
        log.parentId = payload.cashierLogId
        log.cheques = payload.cheques ? JSON.stringify(payload.cheques) : null;
        log.notes = payload.notes ? JSON.stringify(payload.notes) : null;
        log.coins = payload.coins ? JSON.stringify(payload.coins) : null;
        log.modifiedTime = currentTime;
        log.syncedAt = null; // Mark as unsynced
      });

    } else {
      console.error('❌ [WatermelonDB] Cashier log not found for cashierLogId:', payload.cashierLogId);
    }
  });

  // Update cash drawer in app_pref - remove cashierLogId
  await updateCashDrawerInAppPref(payload.cashDrawerId, {
    cashierLogId: '',
    modifiedTime: formatModifiedTime(),
  });

  console.log('🎉 [WatermelonDB] Shift completion data updated successfully in WatermelonDB!');
};

/**
 * Get current shift details offline from WatermelonDB
 */
export const getLogShiftDetailsOffline = async (payload: CureentLogShiftDetailsPayload): Promise<LogShiftDetails> => {
  

  try {
    let currentBalance: number | null = null;
    let time: string | null = null;
    let todaySales: number | null = null;
    let cashTransactionCount: number | null = null;
    let activeCashierLogId: string | null = payload.cashierLogId || null;

    // Get locationId from payload or state
    const locationId = payload.locationId || getState()?.restaurant?.currentRestaurantDetail?.id;

    // Get cashierLogId from cash drawer if not provided
    const drawers = await getCashDrawersFromAppPref();
    const cashDrawer = drawers.find(d => d.cashDrawerId === payload.cashDrawerId);
    
    if (cashDrawer) {
      // If cashierLogId is not in payload, get it from cash drawer
      if (!activeCashierLogId && cashDrawer.cashierLogId && cashDrawer.cashierLogId !== '') {
        activeCashierLogId = cashDrawer.cashierLogId;
        console.log('📊 [WatermelonDB] Using cashierLogId from cash drawer:', activeCashierLogId);
      }
    }

    // Get time and calculate currentBalance from cashier log and transactions
    if (activeCashierLogId) {
      const cashierLogs = await database.collections
        .get<VaultCashierLog>('mh_cashier_log')
        .query()
        .fetch();

      const cashierLog = cashierLogs.find(l => l.id === activeCashierLogId);
      
      if (cashierLog) {
        time = cashierLog.createdTime || null;
        
        // Calculate currentBalance dynamically: floatAmount + payIn - payOut
        const floatAmount = parseFloat(cashierLog.floatAmt) || 0;
        
        // Get all expense logs for this shift
        const expenseLogs = await database.collections
          .get<VaultExpenseLog>('mh_expense_log')
          .query()
          .fetch();
        
        const shiftExpenses = expenseLogs.filter(
          log => log.cashierLogId === activeCashierLogId
        );
        
        // Calculate payIn and payOut totals
        let payIn = 0;
        let payOut = 0;
        
        for (const exp of shiftExpenses) {
          if (exp.payIn) {
            payIn += parseFloat(exp.payIn);
          }
          if (exp.payOut) {
            payOut += parseFloat(exp.payOut);
          }
        }
        
        // Calculate cashierSales from expense logs with category 'SALES'
        const cashierSales = await calculateCashierSalesFromExpenseLogs(
          activeCashierLogId,
          time
        );
        
        // ✅ Calculate todaySales from ALL expense logs with category 'SALES' for TODAY
        todaySales = await calculateTodaySalesFromExpenseLogs(
          payload.cashDrawerId,
          locationId
        );
        
        // ✅ Count cash transactions (expense logs with category 'SALES')
        const salesExpenseLogs = shiftExpenses.filter(
          log => log.category === 'SALES' && log.payIn != null && parseFloat(log.payIn) > 0
        );
        cashTransactionCount = salesExpenseLogs.length;
        
        currentBalance = floatAmount + cashierSales + payIn - payOut;
        
        console.log('📊 [WatermelonDB] Calculated current balance:', {
          floatAmount,
          payIn,
          payOut,
          cashierSales,
          currentBalance,
          todaySales,
          cashTransactionCount,
        });
        
        console.log('📊 [WatermelonDB] Found cashier log:', {
          id: cashierLog.id,
          createdTime: cashierLog.createdTime,
          statusId: cashierLog.statusId,
        });
      } else {
        console.warn('⚠️ [WatermelonDB] Cashier log not found for cashierLogId:', activeCashierLogId);
      }
    } else {
      // If no cashierLogId, try to find active shift (statusId = 50) for this cash drawer
      console.log('🔄 [WatermelonDB] No cashierLogId provided, searching for active shift...');
      const cashierLogs = await database.collections
        .get<VaultCashierLog>('mh_cashier_log')
        .query()
        .fetch();

      const activeShift = cashierLogs.find(
        l => l.cashDrawerDeviceId === payload.cashDrawerId && l.statusId === 50
      );
      
      if (activeShift) {
        activeCashierLogId = activeShift.id;
        time = activeShift.createdTime || null;
        
        // Calculate currentBalance for active shift
        const floatAmount = parseFloat(activeShift.floatAmt) || 0;
        
        // Get all expense logs for this shift
        const expenseLogs = await database.collections
          .get<VaultExpenseLog>('mh_expense_log')
          .query()
          .fetch();
        
        const shiftExpenses = expenseLogs.filter(
          log => log.cashierLogId === activeShift.id
        );
        
        // Calculate payIn and payOut totals
        let payIn = 0;
        let payOut = 0;
        
        for (const exp of shiftExpenses) {
          if (exp.payIn) {
            payIn += parseFloat(exp.payIn);
          }
          if (exp.payOut) {
            payOut += parseFloat(exp.payOut);
          }
        }
        
        // ✅ Calculate cashierSales from expense logs with category 'SALES'
        const cashierSales = await calculateCashierSalesFromExpenseLogs(
          activeShift.id,
          time
        );
        
        // ✅ Calculate todaySales from ALL expense logs with category 'SALES' for TODAY
        todaySales = await calculateTodaySalesFromExpenseLogs(
          payload.cashDrawerId,
          locationId
        );
        
        // ✅ Count today's cash transactions
        cashTransactionCount = await calculateTodayCashTransactionCount(
          payload.cashDrawerId,
          locationId
        );
        
        currentBalance = floatAmount + cashierSales + payIn - payOut;
        
        console.log('📊 [WatermelonDB] Calculated current balance for active shift:', {
          floatAmount,
          payIn,
          payOut,
          cashierSales,
          currentBalance,
          todaySales,
          cashTransactionCount,
        });
        
        console.log('📊 [WatermelonDB] Found active shift:', {
          id: activeShift.id,
          createdTime: activeShift.createdTime,
          statusId: activeShift.statusId,
        });
      } else {
        console.warn('⚠️ [WatermelonDB] No active shift found for cashDrawerId:', payload.cashDrawerId);
      }
    }

    const result: LogShiftDetails = {
      currentBalance: currentBalance,
      todaySales: todaySales,  // ✅ Use calculated value instead of null
      cashTransactionCount: cashTransactionCount,  // ✅ Use calculated value instead of null
      time: time,
    };

    console.log('✅ [WatermelonDB] Log shift details fetched successfully!');
    console.log('📊 [WatermelonDB] Result:', result);

    return result;
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching log shift details:', error);
    return {
      currentBalance: null,
      todaySales: null,
      cashTransactionCount: null,
      time: null,
    };
  }
};

/**
 * Add Pay In/Out offline - saves transaction to WatermelonDB and updates cash drawer balance
 */
export const addPayInOutOffline = async (payload: AddPayInPayload): Promise<void> => {
  // Validate required fields
  if (!payload.cashierLogId || payload.cashierLogId === '') {
    throw new Error('Shift must be started before adding transactions');
  }
  
  if (!payload.cashDrawerId || payload.cashDrawerId === '') {
    throw new Error('Cash drawer not selected');
  }

  if (!payload.payIn && !payload.payOut) {
    throw new Error('Amount is required');
  }

  const currentTime = formatTimestamp();
  console.log("currentTime", currentTime);
  console.log('🔄 [WatermelonDB] Starting to save pay in/out transaction...');
  console.log('📦 [WatermelonDB] Payload received:', payload);

  try {
    await database.write(async () => {
      // Create expense log record in WatermelonDB
      const createdExpense = await database.collections
        .get<VaultExpenseLog>('mh_expense_log')
        .create((log) => {
          log.locationId = payload.locationId;
          log.cashDrawerDeviceId = payload.cashDrawerId;
          log.type = payload.type;
          log.name = payload.reason || null;
          log.category = payload.category;
          log.payIn = payload.payIn ? payload.payIn.toString() : null;
          log.payOut = payload.payOut ? payload.payOut.toString() : null;
          log.createdTime = currentTime;
          log.modifiedTime = currentTime;
          log.cashierLogId = payload.cashierLogId;
          log.staffName = payload.staffName || null;
          log.syncedAt = null;
        });

      console.log('✅ [WatermelonDB] Expense log record created successfully!');
      console.log('🆔 [WatermelonDB] Generated expense log ID:', createdExpense.id);
    });

    // Update cash drawer balance in app_pref
    const drawers = await getCashDrawersFromAppPref();
    const cashDrawer = drawers.find(d => d.cashDrawerId === payload.cashDrawerId);

    if (cashDrawer) {
      const currentBalance = cashDrawer.currentBalance || 0;
      let newBalance = currentBalance;

      if (payload.payIn) {
        newBalance = currentBalance + payload.payIn;
        console.log(`💰 [WatermelonDB] Pay In: ${currentBalance} + ${payload.payIn} = ${newBalance}`);
      } else if (payload.payOut) {
        newBalance = currentBalance - payload.payOut;
        console.log(`💰 [WatermelonDB] Pay Out: ${currentBalance} - ${payload.payOut} = ${newBalance}`);
      }

      await updateCashDrawerInAppPref(payload.cashDrawerId, {
        currentBalance: newBalance,
        modifiedTime: formatModifiedTime(),
      });
      
      console.log('✅ [WatermelonDB] Cash drawer balance updated successfully!');
      console.log(`💰 [WatermelonDB] New balance: ${newBalance}`);
    } else {
      console.warn('⚠️ [WatermelonDB] Cash drawer not found for cashDrawerId:', payload.cashDrawerId);
      console.warn('⚠️ [WatermelonDB] Cannot update balance. Drawer must exist in app_pref.');
      // Optionally, you could create the drawer here, but it's better to ensure it exists when starting shift
    }

    console.log('✅ [WatermelonDB] Pay in/out transaction saved successfully!');
  } catch (error: any) {
    console.error('❌ [WatermelonDB] Error saving pay in/out transaction:', error);
    throw error;
  }
};

/**
 * Calculate cashier sales from expense logs with category 'SALES'
 * This represents total cash sales for the shift
 */
const calculateCashierSalesFromExpenseLogs = async (
  cashierLogId: string,
  shiftStartTime: string | null
): Promise<number> => {
  try {
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    // Filter expense logs for this shift with category 'SALES'
    const salesExpenseLogs = expenseLogs.filter(
      log => 
        log.cashierLogId === cashierLogId &&
        log.category === 'SALES' &&
        log.payIn != null &&
        parseFloat(log.payIn) > 0
    );

    // If shiftStartTime is provided, filter by time (transactions after shift start)
    let filteredLogs = salesExpenseLogs;
    if (shiftStartTime) {
      filteredLogs = salesExpenseLogs.filter(log => {
        // Parse createdTime string (format: "YYYY-MM-DD HH:mm:ss AM/PM") using momentTz
        let logTime: number | null = null;
        let shiftStart: number | null = null;
        
        if (log.createdTime) {
          try {
            const parsedDate = momentTz(log.createdTime, 'YYYY-MM-DD hh:mm:ss A');
            if (parsedDate.isValid()) {
              logTime = parsedDate.toDate().getTime();
            } else {
              const fallbackDate = new Date(log.createdTime);
              if (!isNaN(fallbackDate.getTime())) {
                logTime = fallbackDate.getTime();
              }
            }
          } catch (error) {
            const fallbackDate = new Date(log.createdTime);
            if (!isNaN(fallbackDate.getTime())) {
              logTime = fallbackDate.getTime();
            }
          }
        }
        
        if (shiftStartTime) {
          try {
            const parsedShiftStart = momentTz(shiftStartTime, 'YYYY-MM-DD hh:mm:ss A');
            if (parsedShiftStart.isValid()) {
              shiftStart = parsedShiftStart.toDate().getTime();
            } else {
              const fallbackDate = new Date(shiftStartTime);
              if (!isNaN(fallbackDate.getTime())) {
                shiftStart = fallbackDate.getTime();
              }
            }
          } catch (error) {
            const fallbackDate = new Date(shiftStartTime);
            if (!isNaN(fallbackDate.getTime())) {
              shiftStart = fallbackDate.getTime();
            }
          }
        }
        
        if (logTime === null || shiftStart === null) {
          return false; // Skip if we can't parse the dates
        }
        
        return logTime >= shiftStart;
      });
    }

    // Sum up all payIn amounts from SALES category
    let cashierSales = 0;
    for (const log of filteredLogs) {
      if (log.payIn) {
        cashierSales += parseFloat(log.payIn);
      }
    }

    console.log('💰 [CashierSales] Calculated from expense logs:', {
      cashierLogId,
      totalSalesLogs: filteredLogs.length,
      cashierSales,
    });

    return cashierSales;
  } catch (error) {
    console.error('❌ [CashierSales] Error calculating from expense logs:', error);
    return 0;
  }
};

/**
 * Calculate today's sales from expense logs with category 'SALES'
 * This represents all cash sales that happened TODAY (calendar date), not just current shift
 */
const calculateTodaySalesFromExpenseLogs = async (
  cashDrawerId: string,
  locationId?: string
): Promise<number> => {
  try {
    // Get restaurant timezone
    let timeZone = 'UTC';
    try {
      const restaurantDetails = getState()?.restaurant?.currentRestaurantDetail;
      timeZone = restaurantDetails?.timeZoneCd || 'UTC';
    } catch (error) {
      console.warn('⚠️ [TodaySales] Error getting timezone, using UTC:', error);
    }

    // Get today's date range in restaurant timezone
    const todayStart = momentTz().tz(timeZone).startOf('day').toDate();
    const todayEnd = momentTz().tz(timeZone).endOf('day').toDate();

    console.log('📅 [TodaySales] Today range:', {
      timeZone,
      start: todayStart.toISOString(),
      end: todayEnd.toISOString(),
      cashDrawerId, // ✅ Log cashDrawerId for debugging
    });

    // Get all expense logs
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    // ✅ Filter expense logs for TODAY with category 'SALES' and matching cashDrawerDeviceId
    const todaySalesLogs = expenseLogs.filter(log => {
      // Parse createdTime string (format: "YYYY-MM-DD HH:mm:ss AM/PM") using momentTz
      let logTime: Date | null = null;
      if (log.createdTime) {
        try {
          // Parse the AM/PM format: "2025-11-20 03:46:47 PM"
          const parsedDate = momentTz(log.createdTime, 'YYYY-MM-DD hh:mm:ss A');
          if (parsedDate.isValid()) {
            logTime = parsedDate.toDate();
          } else {
            // Fallback: try parsing as ISO or other formats
            const fallbackDate = new Date(log.createdTime);
            if (!isNaN(fallbackDate.getTime())) {
              logTime = fallbackDate;
            }
          }
        } catch (error) {
          console.warn('⚠️ [TodaySales] Error parsing createdTime:', log.createdTime, error);
          // Try fallback parsing
          const fallbackDate = new Date(log.createdTime);
          if (!isNaN(fallbackDate.getTime())) {
            logTime = fallbackDate;
          }
        }
      }
      
      if (!logTime) {
        return false; // Skip if we can't parse the date
      }
      
      const isToday = logTime >= todayStart && logTime <= todayEnd;
      const isSales = log.category === 'SALES' && log.payIn != null && parseFloat(log.payIn) > 0;
      const matchesCashDrawer = log.cashDrawerDeviceId === cashDrawerId; // ✅ Filter by cashDrawerDeviceId
      
      return isToday && isSales && matchesCashDrawer; // ✅ Include cashDrawer filter
    });

    // If locationId is provided, also filter by location
    let filteredLogs = todaySalesLogs;
    if (locationId) {
      filteredLogs = todaySalesLogs.filter(log => log.locationId === locationId);
    }

    // Sum up all payIn amounts from SALES category for today
    let todaySales = 0;
    for (const log of filteredLogs) {
      if (log.payIn) {
        todaySales += parseFloat(log.payIn);
      }
    }

    console.log('💰 [TodaySales] Calculated from expense logs:', {
      timeZone,
      cashDrawerId, // ✅ Log for debugging
      totalSalesLogs: filteredLogs.length,
      todaySales,
      // ✅ Log sample of filtered logs for debugging
      sampleLogs: filteredLogs.slice(0, 3).map(log => ({
        id: log.id,
        createdTime: log.createdTime,
        payIn: log.payIn,
        cashDrawerDeviceId: log.cashDrawerDeviceId,
      })),
    });

    return todaySales;
  } catch (error) {
    console.error('❌ [TodaySales] Error calculating from expense logs:', error);
    return 0;
  }
};

/**
 * Count today's cash transactions
 */
const calculateTodayCashTransactionCount = async (
  cashDrawerId: string,
  locationId?: string
): Promise<number> => {
  try {
    // Get restaurant timezone
    let timeZone = 'UTC';
    try {
      const restaurantDetails = getState()?.restaurant?.currentRestaurantDetail;
      timeZone = restaurantDetails?.timeZoneCd || 'UTC';
    } catch (error) {
      console.warn('⚠️ [TodaySales] Error getting timezone, using UTC:', error);
    }

    // Get today's date range in restaurant timezone
    const todayStart = momentTz().tz(timeZone).startOf('day').toDate();
    const todayEnd = momentTz().tz(timeZone).endOf('day').toDate();

    // Get all expense logs
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    // ✅ Filter expense logs for TODAY with category 'SALES' and matching cashDrawerDeviceId
    const todaySalesLogs = expenseLogs.filter(log => {
      // Parse createdTime string (format: "YYYY-MM-DD HH:mm:ss AM/PM") using momentTz
      let logTime: Date | null = null;
      if (log.createdTime) {
        try {
          // Parse the AM/PM format: "2025-11-20 03:46:47 PM"
          const parsedDate = momentTz(log.createdTime, 'YYYY-MM-DD hh:mm:ss A');
          if (parsedDate.isValid()) {
            logTime = parsedDate.toDate();
          } else {
            // Fallback: try parsing as ISO or other formats
            const fallbackDate = new Date(log.createdTime);
            if (!isNaN(fallbackDate.getTime())) {
              logTime = fallbackDate;
            }
          }
        } catch (error) {
          console.warn('⚠️ [TodaySales] Error parsing createdTime:', log.createdTime, error);
          // Try fallback parsing
          const fallbackDate = new Date(log.createdTime);
          if (!isNaN(fallbackDate.getTime())) {
            logTime = fallbackDate;
          }
        }
      }
      
      if (!logTime) {
        return false; // Skip if we can't parse the date
      }
      
      const isToday = logTime >= todayStart && logTime <= todayEnd;
      const isSales = log.category === 'SALES' && log.payIn != null && parseFloat(log.payIn) > 0;
      const matchesCashDrawer = log.cashDrawerDeviceId === cashDrawerId; // ✅ Filter by cashDrawerDeviceId
      
      return isToday && isSales && matchesCashDrawer; // ✅ Include cashDrawer filter
    });

    // If locationId is provided, also filter by location
    let filteredLogs = todaySalesLogs;
    if (locationId) {
      filteredLogs = todaySalesLogs.filter(log => log.locationId === locationId);
    }

    return filteredLogs.length;
  } catch (error) {
    console.error('❌ [TodaySales] Error counting transactions:', error);
    return 0;
  }
};

/**
 * Get Pay In/Out transactions offline from WatermelonDB
 */
export const getPayInOutTransactionsOffline = async (payload: PayInTransactionPayload): Promise<ExpenseTransactionResponse> => {
  console.log('🔄 [WatermelonDB] Fetching pay in/out transactions from WatermelonDB...');
  console.log('�� [WatermelonDB] Payload received:', payload);

  try {
    let payInTotal = 0;
    let payOutTotal = 0;
    let payInLastTransaction: string | null = null;
    let payOutLastTransaction: string | null = null;
    const expenseTransactionLogs: ExpenseTransactionLog[] = [];

    // Get all expense logs for this cashierLogId
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    // Filter by cashierLogId
    const filteredLogs = expenseLogs.filter(
      log => log.cashierLogId === payload.cashierLogId
    );

    console.log('📊 [WatermelonDB] Found expense logs:', filteredLogs.length);

    // Process each log
    for (const log of filteredLogs) {
      const payIn = log.payIn ? parseFloat(log.payIn) : 0;
      const payOut = log.payOut ? parseFloat(log.payOut) : 0;

      if (payIn > 0) {
        payInTotal += payIn;
        if (!payInLastTransaction || log.createdTime > payInLastTransaction) {
          payInLastTransaction = log.createdTime;
        }
      }

      if (payOut > 0) {
        payOutTotal += payOut;
        if (!payOutLastTransaction || log.createdTime > payOutLastTransaction) {
          payOutLastTransaction = log.createdTime;
        }
      }

      expenseTransactionLogs.push({
        reason: log.name || '',
        category: log.category,
        transactionsDateTime: log.createdTime,
        cashierName: log.staffName || '',
        amount: payIn > 0 ? payIn : payOut,
        payIn: payIn > 0,
      });
    }

    // Sort by date (newest first)
    expenseTransactionLogs.sort((a, b) => 
      new Date(b.transactionsDateTime).getTime() - new Date(a.transactionsDateTime).getTime()
    );

    const result: ExpenseTransactionResponse = {
      payInTotal: payInTotal > 0 ? payInTotal : null,
      payOutTotal: payOutTotal > 0 ? payOutTotal : null,
      payInLastTransaction: payInLastTransaction,
      payOutLastTransaction: payOutLastTransaction,
      expenseTransactionLogs: expenseTransactionLogs,
    };


    return result;
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching pay in/out transactions:', error);
    return {
      payInTotal: null,
      payOutTotal: null,
      payInLastTransaction: null,
      payOutLastTransaction: null,
      expenseTransactionLogs: [],
    };
  }
};

/**
 * Get complete shift summary offline from WatermelonDB
 */
export const getCompleteShiftSummaryOffline = async (
  payload: CompleteShiftSummaryPayload
): Promise<CompleteShiftSummary> => {
  try {
    // Validate cashierLogId
    if (!payload.cashierLogId || payload.cashierLogId === '') {      
      // Try to find active shift (statusId = 50) for this cash drawer
      const cashierLogs = await database.collections
        .get<VaultCashierLog>('mh_cashier_log')
        .query()
        .fetch();
      const activeShift = cashierLogs.find(
        l => l.cashDrawerDeviceId === payload.cashDrawerId && l.statusId === 50
      );
      if (!activeShift) {
        console.error('❌ [WatermelonDB] No active shift found for cashDrawerId:', payload.cashDrawerId);
        throw new Error('No active shift found');
      }
      // Use the active shift's ID
      payload.cashierLogId = activeShift.id;
      console.log('✅ [WatermelonDB] Found active shift, using cashierLogId:', payload.cashierLogId);
    }

    // Get cashier log to get floatAmount, cheques, and staffId
    const cashierLogs = await database.collections
      .get<VaultCashierLog>('mh_cashier_log')
      .query()
      .fetch();

    console.log('📊 [WatermelonDB] Total cashier logs in database:', cashierLogs.length);
    console.log('🔍 [WatermelonDB] Looking for cashierLogId:', payload.cashierLogId);

    const cashierLog = cashierLogs.find(l => l.id === payload.cashierLogId);

    if (!cashierLog) {
      console.error('❌ [WatermelonDB] Cashier log not found for cashierLogId:', payload.cashierLogId);
      console.log('📊 [WatermelonDB] Available cashier log IDs:', cashierLogs.map(l => ({
        id: l.id,
        cashDrawerDeviceId: l.cashDrawerDeviceId,
        statusId: l.statusId,
      })));
      throw new Error(`Cashier log not found for cashierLogId: ${payload.cashierLogId}`);
    }


    // Get floatAmount from cashier log
    const floatAmount = parseFloat(cashierLog.floatAmt) || 0;

    // Get cheques from cashier log
    const cheques = cashierLog.getCheques();

    // Get all expense logs for this cashierLogId to calculate payIn and payOut
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    const filteredExpenseLogs = expenseLogs.filter(
      log => log.cashierLogId === payload.cashierLogId
    );

    console.log('📊 [WatermelonDB] Found expense logs for this shift:', filteredExpenseLogs.length);

    // Calculate payIn and payOut totals
    let payIn = 0;
    let payOut = 0;
    let staffName = '';

    for (const log of filteredExpenseLogs) {
      if (log.payIn) {
        payIn += parseFloat(log.payIn);
      }
      if (log.payOut) {
        payOut += parseFloat(log.payOut);
      }
      // Get staffName from first expense log if available
      if (!staffName && log.staffName) {
        staffName = log.staffName;
      }
    }

    // Calculate cashierSales from expense logs with category 'SALES'
    const cashierSales = await calculateCashierSalesFromExpenseLogs(
      payload.cashierLogId,
      cashierLog.createdTime
    );

    // Calculate expectedAmount: floatAmount + cashierSales + payIn - payOut
    const expectedAmount = floatAmount + cashierSales + payIn - payOut;

    const result: CompleteShiftSummary = {
      floatAmount,
      payIn,
      payOut,
      cashierSales,
      expectedAmount,
      cheques,
      staffName: staffName || '', // Use empty string if not found
    };


    return result;
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching complete shift summary:', error);
    // Return default values on error
    return {
      floatAmount: 0,
      payIn: 0,
      payOut: 0,
      cashierSales: 0,
      expectedAmount: 0,
      cheques: [],
      staffName: '',
    };
  }
};

/**
 * Get past counts offline from WatermelonDB - last 7 days filtered by cashDrawerId
 */
export const getPastCountsOffline = async (
  payload: PastShiftPayload
): Promise<PastCountList[]> => {
  console.log('🔄 [WatermelonDB] ========== FETCHING PAST COUNTS ==========');
  console.log('📦 [WatermelonDB] Payload received:', JSON.stringify(payload, null, 2));

  try {
    // Calculate date 7 days ago (using restaurant timezone if available)
    let sevenDaysAgo: Date;
    let timeZone = 'UTC';
    try {
      const restaurantDetails = getState()?.restaurant?.currentRestaurantDetail;
      timeZone = restaurantDetails?.timeZoneCd || 'UTC';
      console.log('🌍 [WatermelonDB] Using timezone:', timeZone);
      // Get current time in restaurant timezone, subtract 7 days
      const nowInTz = momentTz().tz(timeZone);
      sevenDaysAgo = nowInTz.subtract(7, 'days').toDate();
      console.log('📅 [WatermelonDB] 7 days ago (in timezone):', nowInTz.subtract(7, 'days').format('YYYY-MM-DD HH:mm:ss A'));
    } catch (error) {
      console.warn('⚠️ [WatermelonDB] Error getting timezone, using device time:', error);
      // Fallback to device time
      sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    }

    console.log('📅 [WatermelonDB] Filtering shifts from last 7 days (since):', sevenDaysAgo.toISOString());
    console.log('📅 [WatermelonDB] Current time:', new Date().toISOString());
    console.log('📅 [WatermelonDB] 7 days ago timestamp:', sevenDaysAgo.getTime());

    // Get all cashier logs
    const cashierLogs = await database.collections
      .get<VaultCashierLog>('mh_cashier_log')
      .query()
      .fetch();

    console.log('📊 [WatermelonDB] ========== ALL CASHIER LOGS ==========');
    console.log('📊 [WatermelonDB] Total cashier logs found:', cashierLogs.length);
    
    // Log ALL cashier logs with details
    cashierLogs.forEach((log, index) => {
      console.log(`📋 [WatermelonDB] Log #${index + 1}:`, {
        id: log.id,
        cashDrawerDeviceId: log.cashDrawerDeviceId,
        payloadCashDrawerId: payload.cashDrawerDeviceId,
        statusId: log.statusId,
        createdTime: log.createdTime,
        modifiedTime: log.modifiedTime,
      });
    });

    console.log('🔍 [WatermelonDB] ========== FILTERING SHIFTS ==========');
    console.log('🔍 [WatermelonDB] Looking for cashDrawerDeviceId:', payload.cashDrawerDeviceId);
    console.log('🔍 [WatermelonDB] Looking for statusId: 51 (completed)');

    // Track filter statistics
    const filterStats = {
      total: cashierLogs.length,
      matchesDrawer: 0,
      isCompleted: 0,
      isWithin7Days: 0,
      passesAll: 0,
    };

    // Filter by:
    // 1. cashDrawerDeviceId matches
    // 2. statusId = 51 (completed)
    // 3. createdTime within last 7 days
    const completedShifts = cashierLogs.filter((log) => {
      const matchesDrawer = log.cashDrawerDeviceId === payload.cashDrawerDeviceId;
      const isCompleted = log.statusId === 51;
      
      // Parse createdTime string (format: "YYYY-MM-DD HH:mm:ss AM/PM") to Date
      let isWithin7Days = false;
      let parsedDate: Date | null = null;
      let parseError: string | null = null;
      
      if (log.createdTime) {
        try {
          // Parse the AM/PM format: "2025-11-20 03:46:47 PM"
          const createdDate = momentTz(log.createdTime, 'YYYY-MM-DD hh:mm:ss A');
          if (createdDate.isValid()) {
            parsedDate = createdDate.toDate();
            isWithin7Days = parsedDate >= sevenDaysAgo;
            console.log(`✅ [WatermelonDB] Successfully parsed date for log ${log.id}:`, {
              original: log.createdTime,
              parsed: parsedDate.toISOString(),
              timestamp: parsedDate.getTime(),
              sevenDaysAgoTimestamp: sevenDaysAgo.getTime(),
              isWithin7Days,
            });
          } else {
            parseError = 'Invalid date format';
            // Try parsing as ISO or other formats as fallback
            const fallbackDate = new Date(log.createdTime);
            if (!isNaN(fallbackDate.getTime())) {
              parsedDate = fallbackDate;
              isWithin7Days = parsedDate >= sevenDaysAgo;
              console.log(`⚠️ [WatermelonDB] Used fallback parsing for log ${log.id}:`, {
                original: log.createdTime,
                parsed: parsedDate.toISOString(),
                isWithin7Days,
              });
            } else {
              console.warn(`❌ [WatermelonDB] Could not parse date for log ${log.id}:`, log.createdTime);
            }
          }
        } catch (error: any) {
          parseError = error.message || 'Unknown error';
          console.warn(`❌ [WatermelonDB] Error parsing createdTime for log ${log.id}:`, {
            createdTime: log.createdTime,
            error: parseError,
          });
          // If parsing fails, try direct Date parsing
          const fallbackDate = new Date(log.createdTime);
          if (!isNaN(fallbackDate.getTime())) {
            parsedDate = fallbackDate;
            isWithin7Days = parsedDate >= sevenDaysAgo;
          }
        }
      } else {
        console.warn(`⚠️ [WatermelonDB] Log ${log.id} has no createdTime`);
      }
      
      // Count filter matches
      if (matchesDrawer) filterStats.matchesDrawer++;
      if (isCompleted) filterStats.isCompleted++;
      if (isWithin7Days) filterStats.isWithin7Days++;
      
      // Detailed logging for ALL logs (not just matching drawer)
      console.log(`🔍 [WatermelonDB] Filter check for log ${log.id}:`, {
        id: log.id,
        cashDrawerDeviceId: log.cashDrawerDeviceId,
        payloadCashDrawerId: payload.cashDrawerDeviceId,
        matchesDrawer,
        statusId: log.statusId,
        isCompleted,
        createdTime: log.createdTime,
        parsedDate: parsedDate ? parsedDate.toISOString() : null,
        parsedTimestamp: parsedDate ? parsedDate.getTime() : null,
        sevenDaysAgoTimestamp: sevenDaysAgo.getTime(),
        isWithin7Days,
        parseError,
        PASSES_ALL_FILTERS: matchesDrawer && isCompleted && isWithin7Days,
      });
      
      const passesAll = matchesDrawer && isCompleted && isWithin7Days;
      if (passesAll) filterStats.passesAll++;
      
      return passesAll;
    });

    // Summary of filtering - THIS WILL HELP US DEBUG
    console.log('📊 [WatermelonDB] ========== FILTER SUMMARY ==========');
    console.log('📊 [WatermelonDB] Total cashier logs in database:', filterStats.total);
    console.log('📊 [WatermelonDB] Matches drawer ID:', filterStats.matchesDrawer);
    console.log('📊 [WatermelonDB] Has statusId = 51 (completed):', filterStats.isCompleted);
    console.log('📊 [WatermelonDB] Within last 7 days:', filterStats.isWithin7Days);
    console.log('📊 [WatermelonDB] Passes ALL filters (final result):', filterStats.passesAll);
    console.log('📊 [WatermelonDB] ====================================');

    console.log('📊 [WatermelonDB] ========== FILTER RESULTS ==========');
    console.log('📊 [WatermelonDB] Found completed shifts:', completedShifts.length);
    console.log('📊 [WatermelonDB] Completed shifts details:', completedShifts.map(s => ({
      id: s.id,
      statusId: s.statusId,
      createdTime: s.createdTime,
      amount: s.amount,
      cashDrawerDeviceId: s.cashDrawerDeviceId,
    })));

    // Get all expense logs for calculating transaction amounts
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    console.log('💰 [WatermelonDB] Total expense logs found:', expenseLogs.length);

    const pastCounts: PastCountList[] = [];

    // Process each completed shift
    for (const shift of completedShifts) {
      try {
        console.log('🔄 [WatermelonDB] ========== PROCESSING SHIFT ==========');
        console.log('🔄 [WatermelonDB] Processing shift:', shift.id);
        
        // Get pay in/out transactions for this shift
        const shiftExpenses = expenseLogs.filter(
          (exp) => exp.cashierLogId === shift.id
        );

        console.log('📊 [WatermelonDB] Shift expenses found:', shiftExpenses.length);

        // Calculate pay in and pay out totals
        let payInTotal = 0;
        let payOutTotal = 0;

        for (const exp of shiftExpenses) {
          if (exp.payIn) {
            payInTotal += parseFloat(exp.payIn);
          }
          if (exp.payOut) {
            payOutTotal += parseFloat(exp.payOut);
          }
        }

        // Calculate transaction amount (pay in - pay out)
        const transactionAmount = payInTotal - payOutTotal;

        // Get float amount
        const floatAmount = parseFloat(shift.floatAmt) || 0;

        // Get count (amount at end of shift)
        const count = parseFloat(shift.amount) || 0;

        // Calculate expected amount: floatAmount + transactionAmount
        const expectedAmount = floatAmount + transactionAmount;

        // Status: true if count matches expected amount (within 0.01 tolerance for floating point)
        const status = Math.abs(count - expectedAmount) < 0.01;

        const pastCountItem: PastCountList = {
          time: shift.createdTime || shift.modifiedTime || '',
          floatAmount: floatAmount,
          transactionAmount: transactionAmount,
          count: count,
          status: status,
          cashierLogId: shift.id,
        };

        console.log('✅ [WatermelonDB] Adding past count item:', JSON.stringify(pastCountItem, null, 2));
        pastCounts.push(pastCountItem);
        console.log('📊 [WatermelonDB] Past counts array length after push:', pastCounts.length);
      } catch (error) {
        console.error('❌ [WatermelonDB] Error processing shift:', shift.id, error);
        // Continue processing other shifts even if one fails
      }
    }

    console.log('📊 [WatermelonDB] ========== FINAL RESULTS ==========');
    console.log('📊 [WatermelonDB] Total past counts before sort:', pastCounts.length);

    // Sort by time (newest first)
    try {
      pastCounts.sort((a, b) => {
        try {
          const timeA = a.time ? new Date(a.time).getTime() : 0;
          const timeB = b.time ? new Date(b.time).getTime() : 0;
          return timeB - timeA; // Descending order (newest first)
        } catch (error) {
          console.error('❌ [WatermelonDB] Error parsing date in sort:', error, { timeA: a.time, timeB: b.time });
          return 0;
        }
      });
    } catch (error) {
      console.error('❌ [WatermelonDB] Error sorting past counts:', error);
    }

    console.log('✅ [WatermelonDB] Past counts fetched successfully!');
    console.log('📊 [WatermelonDB] Final result count:', pastCounts.length);
    console.log('📊 [WatermelonDB] Past counts:', JSON.stringify(pastCounts, null, 2));

    return pastCounts;
  } catch (error) {
    console.error('❌ [WatermelonDB] ========== ERROR ==========');
    console.error('❌ [WatermelonDB] Error fetching past counts:', error);
    return [];
  }
};

/**
 * Get log details offline from WatermelonDB for a specific cashierLogId
 * This is used when clicking on a past count item to see detailed shift summary
 */
export const getLogtDetailsOffline = async (
  payload: CureentLogShiftDetailsPayload
): Promise<LogtDetails> => {
  console.log('🔄 [WatermelonDB] Fetching log details from WatermelonDB...');
  console.log('📦 [WatermelonDB] Payload received:', payload);

  try {
    if (!payload.cashierLogId || payload.cashierLogId === '') {
      throw new Error('cashierLogId is required');
    }

    // Get cashier log
    const cashierLogs = await database.collections
      .get<VaultCashierLog>('mh_cashier_log')
      .query()
      .fetch();

    const cashierLog = cashierLogs.find(l => l.id === payload.cashierLogId);

    if (!cashierLog) {
      throw new Error('Cashier log not found');
    }

    console.log('📊 [WatermelonDB] Found cashier log:', {
      id: cashierLog.id,
      statusId: cashierLog.statusId,
      createdTime: cashierLog.createdTime,
      modifiedTime: cashierLog.modifiedTime,
    });

    // Get all expense logs for this cashierLogId
    const expenseLogs = await database.collections
      .get<VaultExpenseLog>('mh_expense_log')
      .query()
      .fetch();

    const shiftExpenses = expenseLogs.filter(
      (exp) => exp.cashierLogId === payload.cashierLogId
    );

    console.log('📊 [WatermelonDB] Found expense logs:', shiftExpenses.length);

    // Calculate pay in and pay out totals
    let payIn = 0;
    let payOut = 0;
    const expenseLogList: expenseLogList[] = [];

    for (const exp of shiftExpenses) {
      const payInAmount = exp.payIn ? parseFloat(exp.payIn) : 0;
      const payOutAmount = exp.payOut ? parseFloat(exp.payOut) : 0;

      if (payInAmount > 0) {
        payIn += payInAmount;
      }
      if (payOutAmount > 0) {
        payOut += payOutAmount;
      }

      // Build expense log list
      expenseLogList.push({
        cashierName: exp.staffName || '',
        reason: exp.name || '',
        amount: payInAmount > 0 ? payInAmount : payOutAmount,
        transactionTime: exp.createdTime || '',
        category: exp.category || '',
        payment: exp.type || 'CASH', // "CASH" or "CHECK"
        payIn: payInAmount > 0,
      });
    }

    // Sort expense logs by time (newest first)
    expenseLogList.sort((a, b) => {
      const timeA = new Date(a.transactionTime).getTime();
      const timeB = new Date(b.transactionTime).getTime();
      return timeB - timeA; // Descending order
    });

    // Get float amount
    const floatAmount = parseFloat(cashierLog.floatAmt) || 0;

    // Get counted amount (amount at end of shift)
    const countedAmount = parseFloat(cashierLog.amount) || 0;

    // Calculate cash sales from expense logs with category 'SALES'
    const cashSales = await calculateCashierSalesFromExpenseLogs(
      payload.cashierLogId,
      cashierLog.createdTime
    );

    // Calculate transaction amount (pay in - pay out)
    // Note: transactionAmount should exclude SALES category payIns since they're in cashSales
    const nonSalesPayIn = payIn - cashSales; // Remove sales from payIn for transaction amount
    const transactionAmount = nonSalesPayIn - payOut;

    // Calculate expected amount: floatAmount + cashSales + payIn - payOut
    const expectedAmount = floatAmount + cashSales + payIn - payOut;

    // Calculate variance: countedAmount - expectedAmount
    const variance = countedAmount - expectedAmount;

    // Get staff name from first expense log or leave empty
    let staffName = '';
    if (shiftExpenses.length > 0 && shiftExpenses[0].staffName) {
      staffName = shiftExpenses[0].staffName;
    }

    // Get shift times
    const shiftStartTime = cashierLog.createdTime || null;
    const shiftEndTime = cashierLog.modifiedTime || null;

    const result: LogtDetails = {
      staffName: staffName,
      expenseLogList: expenseLogList,
      floatAmount: floatAmount,
      cashSales: cashSales,
      payIn: payIn > 0 ? payIn : null,
      payOut: payOut > 0 ? payOut : null,
      expectedAmount: expectedAmount,
      countedAmount: countedAmount,
      variance: variance,
      shiftStartTime: shiftStartTime,
      shiftEndTime: shiftEndTime,
    };

    return result;
  } catch (error) {
    console.error('❌ [WatermelonDB] Error fetching log details:', error);
    // Return default values on error
    return {
      staffName: '',
      expenseLogList: [],
      floatAmount: null,
      cashSales: null,
      payIn: null,
      payOut: null,
      expectedAmount: null,
      countedAmount: null,
      variance: null,
      shiftStartTime: null,
      shiftEndTime: null,
    };
  }
};

// Add formatModifiedTime function if not already present
const formatModifiedTime = (): string => {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const year = String(now.getFullYear()).slice(-2);
  
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  return `${month}/${day}/${year} ${hoursStr}:${minutes} ${ampm}`;
};

// Helper function to get all drawers from app_pref
const getCashDrawersFromAppPref = async (): Promise<RegisterLists[]> => {
  try {
    const value = await Storage.getItem('@mh_set_cash_default');
    if (value !== null) {
      const parsed = JSON.parse(value);
      // Check if it's an array (list of drawers) or single drawer
      if (Array.isArray(parsed)) {
        // Filter out invalid items
        return parsed.filter(
          (drawer): drawer is RegisterLists => 
            drawer != null && 
            typeof drawer === 'object' && 
            drawer.cashDrawerId != null &&
            drawer.cashDrawerId !== ''
        ) as RegisterLists[];
      } else if (parsed?.cashDrawerId) {
        // If it's a single drawer, return as array
        return [parsed as RegisterLists];
      }
    }
    return [];
  } catch (error) {
    console.error('Error getting cash drawers from app_pref:', error);
    return [];
  }
};

// Helper function to save all drawers to app_pref
const saveCashDrawersToAppPref = async (drawers: RegisterLists[]): Promise<void> => {
  try {
    const jsonValue = JSON.stringify(drawers);
    await Storage.setItem('@mh_set_cash_default', jsonValue);
  } catch (error) {
    console.error('Error saving cash drawers to app_pref:', error);
    throw error;
  }
};

// Helper function to update a specific drawer in the array
const updateCashDrawerInAppPref = async (
  cashDrawerId: string,
  updates: Partial<RegisterLists>
): Promise<void> => {
  try {
    const drawers = await getCashDrawersFromAppPref();
    const index = drawers.findIndex(d => d.cashDrawerId === cashDrawerId);
    
    if (index !== -1) {
      // Update existing drawer
      drawers[index] = { ...drawers[index], ...updates };
      await saveCashDrawersToAppPref(drawers);
    } else {
      // Drawer not found, create new one
      const newDrawer: RegisterLists = {
        cashDrawerId,
        registerName: updates.registerName || 'Register',
        floatAmount: updates.floatAmount || 0,
        currentBalance: updates.currentBalance || 0,
        cashierLogId: updates.cashierLogId || '',
        lastUpdated: updates.lastUpdated || updates.modifiedTime || '',
        modifiedTime: updates.modifiedTime || '',
        notes: updates.notes || [],
        coins: updates.coins || [],
      };
      drawers.push(newDrawer);
      await saveCashDrawersToAppPref(drawers);
    }
  } catch (error) {
    console.error('Error updating cash drawer in app_pref:', error);
    throw error;
  }
};

