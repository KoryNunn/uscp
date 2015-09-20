var test = require('tape'),
    modem = require('../modem'),
    crel = require('crel');

window.onload = function(){

    var input,
        submit,
        form,
        output;

    crel(document.body,
        output = crel('div', 'Output:'),
        form = crel('form',
            input = crel('input', {placeholder: 'Message'}),
            submit = crel('button', 'Send')
        )
    );

    form.addEventListener('submit', function(event){
        modem.modulate(input.value);

        input.value = '';

        event.preventDefault();
    });

    modem.demodulate(function(error, message){
        crel(output,
            crel('div', message)
        );
    });

};