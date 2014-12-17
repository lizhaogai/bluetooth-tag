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

//    var sendSoundCommand = true;
    if (channel == 'register') {
        value.emit = function (channel, value) {
//            console.log('Device.emit', channel, value);
            if (value && value.D == 215) {
                console.log('Send Sound Command');
                value.write(1);
            }
        };
    }
};

d.save = function () {
    console.log('Saved opts', opts);
};