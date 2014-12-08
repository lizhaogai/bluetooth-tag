var BluetoothTag = require('./lib/base');
var stream = require('stream');
var util = require('util');

module.exports = BluetoothTag;

BluetoothTag.prototype.scan = function () {
    var self = this;

    var noble = require('noble');

    noble.on('stateChange', function (state) {
        self._app.log.debug('State change', state);
        if (state === 'poweredOn') {

            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    });

    noble.on('scanStart', function () {
        self._app.log.info('Starting scan');
    });

    noble.on('scanStop', function () {
        self._app.log.info('Stopping scan');
    });
    noble.on('discover', function (peripheral) {
        if (!self.peripherals[peripheral.uuid]) {
            self.peripherals[peripheral.uuid] = peripheral;
        }
    });

    noble.on('data', function (data) {
        if (!data.uuid || !self.peripherals[data.uuid]) {
            return;
        }
        if (data.data.length < 8) {
            return;
        }
        var d1 = data.data.readUInt8(1);
        var d2 = data.data.readUInt8(2);
        var d3 = data.data.readUInt8(3);
        var d4 = data.data.readUInt8(4);
        var d5 = data.data.readUInt8(5);

        if (d1 == 5 && d2 == 0 && d3 == 0 && d4 == 0 && d5 == 2) {
            var btTagDevice = self.registerDevice(data.uuid, 0, 50002);
            self.sendData(btTagDevice);

            self.processDistanceDevice(data);
            self.processPresenceDevice(data);
            self.processSoundDevice(data);

            var type = data.data.readUInt8(6);
            var value = data.data.readUInt8(7);
            var device;
            if (type == 1) {
                device = self.registerDevice(data.uuid, 0, 5);
                device.parent = [data.uuid, 0, 50002].join('_')
            } else if (type == 2) {
                device = self.registerDevice(data.uuid, 0, 3);
                device.parent = [data.uuid, 0, 50002].join('_')
            }
            if (device) {
                device.DA = value;
                self.sendData(device);
            }
        }


    });
};

BluetoothTag.prototype.processSoundDevice = function (data) {
    var device = self.registerSoundDevice(data.uuid, 0, 215, [data.uuid, 0, 50002].join('_'));
    device.parent = [data.uuid, 0, 50002].join('_');
    device.DA = '';
    this.sendData(device);
};

BluetoothTag.prototype.processPresenceDevice = function (data) {
    var self = this;
    var device = self.registerDevice(data.uuid, 0, 263);
    device.parent = [data.uuid, 0, 50002].join('_');
    device.DA = "present";
    var DA = "present";
    var lastValue = self.presences[data.uuid];

    if (self.timeouts[data.uuid]) {
        clearTimeout(self.timeouts[data.uuid]);
    }

    self.timeouts[data.uuid] = setTimeout(function () {
        self.presences[data.uuid] = "not present";
        device.DA = "not present";
        self.sendData(device);
        delete(self.timeouts[data.uuid]);
    }, 1000 * 60);

    if (DA != lastValue) {
        self.sendData(device);
    }
};

BluetoothTag.prototype.processDistanceDevice = function (data) {
    var device = self.registerDevice(data.uuid, 0, 10, [data.uuid, 0, 50002].join('_'));
    device.parent = [data.uuid, 0, 50002].join('_');
    device.DA = '';
    this.sendData(device);
};

BluetoothTag.prototype.sendData = function (deviceObj) {
    if (!deviceObj) {
        return;
    }
    var device = this.registeredDevices[guid(deviceObj)];
    if (!device) {
        device = this.registerDevice(deviceObj.G, deviceObj.V, deviceObj.D);
    }
    device.emit('data', deviceObj.DA);
};

BluetoothTag.prototype.registerDevice = function (G, V, D) {
    // If we already have a device for this guid, bail.
    if (this.registeredDevices[guid(G, V, D)]) {
        return this.registeredDevices[guid(G, V, D)];
    }

    var device = new PlatformDevice(G, V, D);
    this.emit('register', device);
    this.registeredDevices[guid(device)] = device;
    return device;
};

BluetoothTag.prototype.registerSoundDevice = function (G, V, D) {
    // If we already have a device for this guid, bail.
    if (this.registeredDevices[guid(G, V, D)]) {
        return this.registeredDevices[guid(G, V, D)];
    }

    var device = new SoundDevice(G, V, D);
    this.emit('register', device);
    this.registeredDevices[guid(device)] = device;
    return device;
};

function guid(G, V, D) {
    return [G, V, D].join('_');
}


function PlatformDevice(G, V, D, parent) {
    if (!D) {
        return false;
    }
    this.V = parseInt(V) || 0;
    this.G = G.toString() || "0";
    this.D = parseInt(D) || undefined;
    this.parent = parent;
};

function SoundDevice(G, V, D) {
    if (!D) {
        return false;
    }
    this.V = parseInt(V) || 0;
    this.G = G.toString() || "0";
    this.D = parseInt(D) || undefined;

    this.write = function (dat) {

    }
};

util.inherits(PlatformDevice, stream);
util.inherits(SoundDevice, stream);


