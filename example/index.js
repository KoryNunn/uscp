var test = require('tape'),
    modem = require('../modem'),
    crel = require('crel');

window.onload = function(){

    var input,
        submit,
        form,
        output,
        status;

    crel(document.body,
        output = crel('div', {class: 'output'}, crel('h3', 'Output:')),
        crel('div', {class: 'status'}, 'Status: ',
            status = crel('span', 'Waiting')
        ),
        form = crel('form',
            input = crel('input', {placeholder: 'Message'}),
            submit = crel('button', 'Send')
        )
    );

    form.addEventListener('submit', function(event){
        status.textContent = 'Sending';
        modem.modulate(input.value, function(){
            status.textContent = 'Sent';
        });

        input.value = '';

        event.preventDefault();
    });

    modem.demodulate(function(error, message){
        crel(output,
            crel('div', message)
        );
    });

};