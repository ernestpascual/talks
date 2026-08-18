import Foundation
import CoreBluetooth

class BleScanner: NSObject, CBCentralManagerDelegate {
    private var manager: CBCentralManager!
    private let queue = DispatchQueue(label: "ble.scanner.queue")
    private var devices: [String: [String: Any]] = [:]
    private let scanDuration: TimeInterval
    private var isScanning = false
    private let semaphore = DispatchSemaphore(value: 0)

    init(duration: TimeInterval = 2.5) {
        self.scanDuration = duration
        super.init()
        self.manager = CBCentralManager(delegate: self, queue: self.queue)
    }

    func scan() -> [[String: Any]] {
        _ = semaphore.wait(timeout: .now() + scanDuration + 2.0)
        queue.sync {
            if isScanning {
                manager.stopScan()
            }
        }
        return Array(devices.values)
    }

    func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            isScanning = true
            manager.scanForPeripherals(
                withServices: nil,
                options: [CBCentralManagerScanOptionAllowDuplicatesKey: true]
            )
            
            DispatchQueue.global().asyncAfter(deadline: .now() + scanDuration) { [weak self] in
                self?.semaphore.signal()
            }
        } else if central.state == .unauthorized || central.state == .unsupported || central.state == .poweredOff {
            semaphore.signal()
        }
    }

    func centralManager(_ central: CBCentralManager, didDiscover peripheral: CBPeripheral, advertisementData: [String : Any], rssi RSSI: NSNumber) {
        let id = peripheral.identifier.uuidString
        let rawName = peripheral.name ?? (advertisementData[CBAdvertisementDataLocalNameKey] as? String)
        let txPower = (advertisementData[CBAdvertisementDataTxPowerLevelKey] as? NSNumber)?.intValue ?? -59
        let isConnectable = (advertisementData[CBAdvertisementDataIsConnectable] as? NSNumber)?.boolValue ?? false

        let displayName = rawName ?? "BLE Device (\(id.suffix(4)))"

        devices[id] = [
            "id": id,
            "name": displayName,
            "hasExplicitName": rawName != nil,
            "rssi": RSSI.intValue,
            "txPower": txPower,
            "isConnectable": isConnectable,
            "lastSeen": Int(Date().timeIntervalSince1970 * 1000)
        ]
    }
}

let duration: TimeInterval = 2.0
let scanner = BleScanner(duration: duration)
let results = scanner.scan()

do {
    let jsonData = try JSONSerialization.data(withJSONObject: results, options: [])
    if let jsonString = String(data: jsonData, encoding: .utf8) {
        print(jsonString)
    } else {
        print("[]")
    }
} catch {
    print("[]")
}
