var util = require('util'),
    stream = require('stream'),
    _ = require('underscore');

util.inherits(BluetoothTag, stream);

function BluetoothTag(opts, app) {
    var self = this;
    this._opts = opts;
    this._app = app;

    opts.timeout = opts.timeout || 1000 * 60;
    opts.scanDelay = opts.scanDelay || 10000;

    this.registeredDevices = [ ];
    this.peripherals = [ ];
    this.timeouts = [ ];
    this.presences = [ ];

    app.on('client::up', function () {
        self.emit('register', self);
        if (self.save) {
            self.save(); // May not be there in the test harness
        }
        if (self.init) {
            self.init();
        }
        if (self.scan) {
            self.startScanning();
        }

        self.restorePersistentDevices();
    });

}

BluetoothTag.prototype.startScanning = function () {
    var self = this;
    setTimeout(function () {
        self._app.log.debug('Scanning');
        self.scan();
    }, this._opts.scanDelay);
};

module.exports = BluetoothTag;