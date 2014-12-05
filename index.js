var BluetoothTag = require('./lib');

module.exports = BluetoothTag;

var peripherals = {};

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
        if (!peripherals[peripheral.uuid]) {
            peripherals[peripheral.uuid] = peripheral;
        }
    });

    noble.on('data', function (data) {
        if (!data.uuid || !peripherals[data.uuid]) {
            return;
        }
        if (data.data.length < 8) {
            return;
        }
        var d1 = data.data.readUInt16BE(1);
        var d2 = data.data.readUInt16BE(2);
        var d3 = data.data.readUInt16BE(3);
        var d4 = data.data.readUInt16BE(4);
        var d5 = data.data.readUInt16BE(5);

        console.log(data.data);
        console.log(d1 + ' ' + d2 + ' ' + d3 + ' ' + d4 + ' ' + d5);
        if (d1 == 5 && d2 == 0 && d3 == 0 && d4 == 0 && d5 == 2) {
            console.log(data.data);
        }

    });
};
