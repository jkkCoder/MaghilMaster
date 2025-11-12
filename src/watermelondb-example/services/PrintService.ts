// services/PrinterService.ts
import database from '../database'
import Printer from '../models/Printer'
import { Collection } from '@nozbe/watermelondb'

interface PrinterData {
  name: string
  type: number
  address: string
  purpose: number
  cuisineId?: string
  stationName?: string
  isStationPrinter: boolean
  isStar: boolean
  is58mm: boolean
  nickName?: string
  magilPrintId?: string
  model?:any
  printTo?:any
  device_id?:any
  merchantId?:any
  locationId?:any
  tabIdentifier?:any
  is_station_printer?:any
  is_star?:any
  isDefault?:any
  isActiveDnd?:any
  isPrintToUpdate?:any
  printerPort?:any
  attributeName?:any
  cuisineIds?:any
  cuisineTagNames?:any
  selectedCuisines?:any
  cuisine_id?:any
  station_name?:any
  nick_name?:any
  magil_print_id?:any
  created_at?:any
  updated_at?:any
}

class PrinterService {
  static async getAllPrinters(): Promise<Printer[]> {
    const collection = database.collections.get('printers') as Collection<Printer>
    return await collection.query().fetch()
  }

  static async savePrinter(printerData: PrinterData): Promise<Printer | null> {
    const collection = database.collections.get('printers') as Collection<Printer>
    
    // Transform address for Star printers (mimic original behavior)
    let printerAddress = printerData.address
    if (printerData.isStar) {
      printerAddress = `TCP:${printerData.address}`
    }

    // Check for existing printer (duplicate prevention)
    const existingPrinter = await Printer.findByAddressAndPurpose(
      database, 
      printerAddress, 
      printerData.purpose, 
      printerData.cuisineId
    )

    if (existingPrinter) {
      console.log('Printer already exists:', existingPrinter.id)
      return existingPrinter
    }

    // Create new printer
    const newPrinter = await database.write(async () => {
      return await collection.create(printer => {
        printer.name = printerData.name
        printer.type = printerData.type
        printer.address = printerAddress
        printer.purpose = printerData.purpose
        printer.cuisineId = printerData.cuisineId || ''
        printer.stationName = printerData.stationName || ''
        printer.isStationPrinter = printerData.isStationPrinter
        printer.isStar = printerData.isStar
        printer.nickName = printerData.nickName || ''
        printer.magilPrintId = printerData.magilPrintId || ''
        printer.model = printerData.model || ''
        printer.printTo = printerData.printTo || ''


        printer.deviceId = printerData.device_id
        printer.merchantId = printerData.merchantId
        printer.locationId = printerData.locationId
        printer.tabIdentifier = printerData.tabIdentifier


        printer.isStationPrinter = printerData.isStationPrinter
        printer.is58mm = printerData.is58mm
        printer.isDefault = printerData.isDefault || ''
        printer.isActiveDnd = printerData.isActiveDnd || ''
        printer.isPrintToUpdate = printerData.isPrintToUpdate || ''


        printer.printerPort = printerData.printerPort || ''
        printer.attributeName = printerData.attributeName || ''


        printer.cuisineIds = printerData.cuisineIds || ''
        printer.cuisineTagNames = printerData.cuisineTagNames || ''
        printer.selectedCuisines = printerData.selectedCuisines || ''

        printer.cuisineId = printerData.cuisineId || ''
        printer.stationName = printerData.stationName || ''
        printer.nickName = printerData.nickName || ''
        printer.magilPrintId = printerData.magilPrintId || ''

        // printer.createdAt = printerData.created_at || ''
        // printer.updatedAt = printerData.updated_at || ''
      })
    })

    return newPrinter
  }

  static async updatePrinter(printerId: string, updateData: Partial<PrinterData>): Promise<Printer> {
    const collection = database.collections.get('printers') as Collection<Printer>
    const printer = await collection.find(printerId)
    
    if (!printer) {
      throw new Error('Printer not found')
    }

    await database.write(async () => {
      await printer.update(record => {
        if (updateData.name !== undefined) record.name = updateData.name
        if (updateData.type !== undefined) record.type = updateData.type
        if (updateData.address !== undefined) {
          let address = updateData.address
          if (record.isStar) {
            address = `TCP:${address}`
          }
          record.address = address
        }
        if (updateData.purpose !== undefined) record.purpose = updateData.purpose
        if (updateData.cuisineId !== undefined) record.cuisineId = updateData.cuisineId || ''
        if (updateData.stationName !== undefined) record.stationName = updateData.stationName || ''
        if (updateData.isStationPrinter !== undefined) record.isStationPrinter = updateData.isStationPrinter
        if (updateData.isStar !== undefined) record.isStar = updateData.isStar
        if (updateData.is58mm !== undefined) record.is58mm = updateData.is58mm
        if (updateData.nickName !== undefined) record.nickName = updateData.nickName || ''
        if (updateData.magilPrintId !== undefined) record.magilPrintId = updateData.magilPrintId || ''
      })
    })

    return printer
  }

  static async deletePrinter(address: string, purpose: number, cuisineId?: string): Promise<boolean> {
    const existingPrinter = await Printer.findByAddressAndPurpose(
      database, 
      address, 
      purpose, 
      cuisineId
    )

    if (!existingPrinter) {
      console.log('No such printer configuration available!')
      return false
    }

    await database.write(async () => {
      await existingPrinter.destroyPermanently()
    })

    return true
  }

  static async deleteAllPrinters(): Promise<number> {
    const collection = database.collections.get('printers') as Collection<Printer>
    const printers = await collection.query().fetch()
    
    await database.write(async () => {
      await Promise.all(printers.map(printer => printer.destroyPermanently()))
    })

    return printers.length
  }

  static async updatePrinterIP(oldAddress: string, newAddress: string): Promise<number> {
    const collection = database.collections.get('printers') as Collection<Printer>
    const printers = await collection.query(
      Q.where('address', oldAddress)
    ).fetch()

    let updatedCount = 0
    await database.write(async () => {
      for (const printer of printers) {
        await printer.update(record => {
          record.address = newAddress
        })
        updatedCount++
      }
    })

    return updatedCount
  }

  // Additional utility methods
//   static async getPrintersByType(type: number): Promise<Printer[]> {
//     return await Printer.findByType(database, type)
//   }

//   static async getPrintersByPurpose(purpose: number): Promise<Printer[]> {
//     return await Printer.findByPurpose(database, purpose)
//   }

//   static async getStationPrinters(): Promise<Printer[]> {
//     return await Printer.findStationPrinters(database)
//   }

//   static async getStarPrinters(): Promise<Printer[]> {
//     return await Printer.findStarPrinters(database)
//   }
}


export default PrinterService