var opts = {};

var d = new (require('./index'))(opts, {
    on: function (x, cb) {
        setTimeout(cb, 100);
    },
    log: {
        debug: console.log,
        info: console.log,
        warn: console.log,
        error: console.log
    }
});

d.emit = function (channel, value) {
    console.log('Driver.emit', channel, value);
    if (channel == 'register') {
        value.emit = function (channel, value) {
            console.log('Device.emit', channel, value);
        };
    }
};

d.save = function () {
    console.log('Saved opts', opts);
};

function delay(interval) {
    var timeout = 0;

    return function (time, callback) {
        if (typeof time === "function") {
            callback = time;
            time = null;
        }
        timeout += (time || interval);
        setTimeout(callback, timeout);
    };
};

delay(50000)(function () {
    var registeredDevices = d.registeredDevices;

    for (var guid in registeredDevices) {
        var device = registeredDevices[guid];
        if (device.D == 215) {
            device.write(1);
        }
    }
});
