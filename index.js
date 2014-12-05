var BluetoothTag = require('./lib');

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
        self.see({
            name: peripheral.advertisement.localName,
            manufacturerData: peripheral.advertisement.manufacturerData,
            id: peripheral.uuid,
            distance: Math.abs(peripheral.rssi)
        });
    });

    noble.on('data', function (data) {
        console.log('-------------------------');
        console.log(data);
        console.log('-------------------------');
    });
};
