var test = require('tape'),
    encdec = require('../encdec'),
    modem = require('../modem');

test('encode - decode simple string', function(t){
    t.plan(1);

    var input = 'hello world',
        result =  encdec.decode(encdec.encode(input));

    t.equal(result, input);
});

test('play annoying sound', function(t){
    t.plan(1);

    var input = 'Modulate that shit, Robust AF!';

    modem.demodulate(function(error, message){
        t.equal(message, input);
    });

    setTimeout(function(){
        modem.modulate(input);
    }, 2000);
});