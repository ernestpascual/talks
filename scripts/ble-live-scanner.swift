import Foundation
import CoreBluetooth

class BleLiveScanner: NSObject, CBCentralManagerDelegate {
    var central: CBCentralManager!
    var devices: [String: [String: Any]] = [:]

    override init() {
        super.init()
        central = CBCentralManager(delegate: self, queue: nil)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            central.scanForPeripherals(
                withServices: nil,
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
            )
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        let rawRssi = RSSI.intValue
        if rawRssi >= 0 || rawRssi < -110 { return } // ignore invalid

        let id = peripheral.identifier.uuidString
        let rawName = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
        let txPower = (advertisementData[CBAdvertisementDataTxPowerLevelKey] as? NSNumber)?.intValue ?? -59
        let isConnectable = (advertisementData[CBAdvertisementDataIsConnectable] as? NSNumber)?.boolValue ?? false

        let displayName = rawName ?? "BLE Device (\(id.suffix(4)))"

        if var existing = devices[id] {
            // Smooth RSSI (EMA)
            let prevRssi = existing["rssi"] as? Int ?? rawRssi
            let smoothed = Int(round(0.4 * Double(rawRssi) + 0.6 * Double(prevRssi)))
            existing["rssi"] = smoothed
            existing["lastSeen"] = Int(Date().timeIntervalSince1970 * 1000)
            if rawName != nil {
                existing["name"] = displayName
                existing["hasExplicitName"] = true
            }
            devices[id] = existing
        } else {
            devices[id] = [
                "id": id,
                "name": displayName,
                "hasExplicitName": rawName != nil,
                "rssi": rawRssi,
                "txPower": txPower,
                "isConnectable": isConnectable,
                "lastSeen": Int(Date().timeIntervalSince1970 * 1000)
            ]
        }
    }
}

let scanner = BleLiveScanner()
let scanDuration: TimeInterval = 1.2
let endTime = Date().addingTimeInterval(scanDuration)

while Date() < endTime {
    RunLoop.current.run(until: Date().addingTimeInterval(0.08))
}

scanner.central.stopScan()

let outputList = Array(scanner.devices.values)

do {
    let jsonData = try JSONSerialization.data(withJSONObject: outputList, options: [])
    if let jsonStr = String(data: jsonData, encoding: .utf8) {
        print(jsonStr)
    } else {
        print("[]")
    }
} catch {
    print("[]")
}
