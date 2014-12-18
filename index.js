var BluetoothTag = require('./lib/base');
var stream = require('stream');
var util = require('util');
var debug = require('debug')('bluetooth-tag');
var dissolve = require('dissolve');
var concentrate = require('concentrate');
var child = require('child_process');
var _ = require('underscore');

var PORTABLE_TAG_ID = 50002;
var PRESENCE_ID = 263;
var SOUND_ID = 215;
var DISTANCE_ID = 10;
var JIGGLE_ID = 3;
var BUTTON_ID = 5;

var PRESENT = "present";
var NOT_PRESENT = "not present";

module.exports = BluetoothTag;

var peripherals = [ ];

BluetoothTag.prototype.scan = function () {
    var self = this;

    var noble = require('noble');

    noble.on('stateChange', function (state) {
        self._app.log.debug('State change', state);
        if (state === 'poweredOn') {

            noble.startScanning();
        } else {
            noble.stopScanning();

//            child.exec('hciconfig', function (err, stdout, stderr) {
//                self._app.log.debug(stdout);
//            });
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

        if (!peripherals[peripheral.uuid]) {
            peripherals[peripheral.uuid] = peripheral;
        }
    });

    noble.on('data', function (data) {
        if (!data.uuid || !self.peripherals[data.uuid]) {
            return;
        }

        if (self.registeredDevices[guid(data.uuid, 0, PRESENCE_ID)]) {
            self.processPresenceDevice(data);
        }

        if (self.registeredDevices[guid(data.uuid, 0, DISTANCE_ID)]) {
            self.processDistanceDevice(data);
        }

        var parser = dissolve().loop(function (end) {
            this.uint8("length").tap(function () {
                if (!this.vars.length || this.vars.length < 0x07) {
                    self._app.log.debug('not enough length');
                    end();
                } else {
                    this.uint8("d1").uint8("d2").uint8("d3").uint8("d4").uint8("d5");
                }
            }).tap(function () {
                var did = this.vars.d1 + '' + this.vars.d2 + '' + this.vars.d3 + '' + this.vars.d4 + '' + this.vars.d5;
                if (did == (PORTABLE_TAG_ID + '')) {
                    delete this.vars.d1;
                    delete this.vars.d2;
                    delete this.vars.d3;
                    delete this.vars.d4;
                    delete this.vars.d5;
                    this.vars.pid = PORTABLE_TAG_ID;
                    this.uint8("did").uint8('value');
                } else {
                    self._app.log.debug('not support data');
                }
            }).tap(function () {
                if (this.vars.pid == PORTABLE_TAG_ID) {
                    if (this.vars.did == 1) {
                        this.vars.did = BUTTON_ID;
                    } else if (this.vars.did == 2) {
                        this.vars.did = JIGGLE_ID;
                    }

                    this.push(this.vars);
                    this.vars = {};
                }
            });
        });

        parser.on('data', function (obj) {
            var btTagDevice = self.registerDevice(data.uuid, 0, obj.pid);
            self.sendData(btTagDevice);

            self.processDistanceDevice(data);
            self.processPresenceDevice(data);
            self.processSoundDevice(data);

            if (obj.did) {
                var device = self.registerDevice(data.uuid, 0, obj.did);
                device.P = [data.uuid, 0, PORTABLE_TAG_ID].join('_');
                device.DA = obj.value;
                self.sendData(device);
            }
        });

        parser.write(data.data);
    });
};

BluetoothTag.prototype.processSoundDevice = function (data) {
    var device = this.registerSoundDevice(data.uuid, 0, SOUND_ID);
    device.P = [data.uuid, 0, PORTABLE_TAG_ID].join('_');
    device.DA = '';
    if (!device.emited) {
        device.emited = true;
        this.sendData(device);
    }
};

BluetoothTag.prototype.processPresenceDevice = function (data) {
    var self = this;
    var device = self.registerDevice(data.uuid, 0, PRESENCE_ID);
    device.P = [data.uuid, 0, PORTABLE_TAG_ID].join('_');
    device.DA = PRESENT;
    var DA = PRESENT;
    var lastValue = self.presences[data.uuid];

    if (self.timeouts[data.uuid]) {
        clearTimeout(self.timeouts[data.uuid]);
    }

    self.timeouts[data.uuid] = setTimeout(function () {
        self.presences[data.uuid] = NOT_PRESENT;
        device.DA = NOT_PRESENT;
        self.sendData(device);
        delete(self.timeouts[data.uuid]);
    }, 1000 * 60);

    if (DA != lastValue) {
        self.sendData(device);
    }
};

BluetoothTag.prototype.processDistanceDevice = function (data) {
    var device = this.registerDevice(data.uuid, 0, DISTANCE_ID);
    device.P = [data.uuid, 0, PORTABLE_TAG_ID].join('_');
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
    if (this.registeredDevices[guid(G, V, D)]) {
        return this.registeredDevices[guid(G, V, D)];
    }

    var device = new PlatformDevice(G, V, D);
    this.emit('register', device);
    this.registeredDevices[guid(device)] = device;
    return device;
};

BluetoothTag.prototype.restorePersistentDevices = function () {
    var self = this;
    var persistentDevices = self._opts.persistentDevices;
    if (!persistentDevices) {
        return;
    }
    persistentDevices.forEach(function (persistentGuid) {

        var deviceAttributes = persistentGuid.split('_');
        if (deviceAttributes.length < 3) {
            return;
        }

        self.registerDevice(deviceAttributes[0]
            , deviceAttributes[1]
            , deviceAttributes[2]
        );

    });
};

BluetoothTag.prototype.registerSoundDevice = function (G, V, D) {
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


function PlatformDevice(G, V, D) {
    if (!D) {
        return false;
    }
    this.V = parseInt(V) || 0;
    this.G = G.toString() || "0";
    this.D = parseInt(D) || undefined;
};

function SoundDevice(G, V, D) {
    var self = this;
    if (!D) {
        return false;
    }
    this.V = parseInt(V) || 0;
    this.G = G.toString() || "0";
    this.D = parseInt(D) || undefined;

    this.write = function (dat) {
        var uuid = this.G;
        var peripheral = peripherals[uuid];
        if (peripheral) {

            peripheral.on('connect', function () {
                this.updateRssi();
            });

            peripheral.on('disconnect', function () {
            });

            peripheral.on('rssiUpdate', function (rssi) {
                this.discoverServices();
            });

            peripheral.on('servicesDiscover', function (services) {
                debug("Service Discover");
                var isSend = false;
                _.forEach(services, function (service) {
                    if (service.uuid.toLowerCase() == "fff0") {
                        debug("Start discover characteristics");
//                        service.on('includedServicesDiscover', function (includedServiceUuids) {
//                            debug(includedServiceUuids);
//                            this.discoverCharacteristics();
//                        });

                        service.on('characteristicsDiscover', function (characteristics) {
                            debug("Characteristics Discover");
                            debug(characteristics);
                            _.forEach(characteristics, function (characteristic) {
                                if (characteristic.uuid.toLowerCase() == "fff1") {
                                    characteristic.on('write', function () {
                                        debug("Write value");
                                        peripheral.disconnect();
                                    });
                                    var Concentrate = new concentrate();

                                    var data = Concentrate.uint8(7).uint8(5).uint8(0).uint8(0).uint8(0).uint8(2).uint8(3).uint8(dat).result();
                                    characteristic.write(data, true, function (error) {
                                        if (error) {
                                            return debug(error);
                                        }
                                    });
                                }
                            });

                        });

                        service.discoverCharacteristics();
//                        service.discoverIncludedServices();
                    }
                });
                if (!isSend) {
                    peripheral.disconnect();
                }
            });
            peripheral.connect();
        }
    }
};

util.inherits(PlatformDevice, stream);
util.inherits(SoundDevice, stream);


