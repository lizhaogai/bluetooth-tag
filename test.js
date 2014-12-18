var opts = {};

var d = new (require('./index'))(opts, {
    on: function (x, cb) {
        setTimeout(cb, 100);
    },
    log: {
        debug: function () {
        },
        info: console.log,
        warn: console.log,
        error: console.log
    }
});

d.emit = function (channel, value) {
    console.log('Driver.emit', channel, value);

    var sendSoundCommand = true;
    if (channel == 'register') {
        value.emit = function (channel, value) {
//            console.log('Device.emit', channel, value);
            if (value && value.D == 215) {
                if (sendSoundCommand) {
                    console.log('Delay to send command');
                    delay(50000)(function () {
                        console.log('Send Sound Command');
                        value.write(1);
                    });
                    sendSoundCommand = false;
                }
            }
        };
    }
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

d.save = function () {
    console.log('Saved opts', opts);
};
