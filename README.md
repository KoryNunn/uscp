# USCP

Ultra Sonic Communication Protocol

## What

Uses ultrasonic frequencies to send 8 bit data to devices pretty close to you.

## How

USCP encodes each Byte of data into each tone. A tone is transmitted for a short period of time before moving on to the next byte.

Each bit column data in a byte has it's own frequency, for example

(not the actual freqs used)

```
abcdefgh
10100101

```

a -> 19000
b -> 19000 + 100hz
c -> 19000 + 200hz
d -> 19000 + 300hz
etc..

[This makes pretty things on a spectrogram.](https://twitter.com/KoryNunn/status/645578328359866373)

The decoder watches the input as fast as possible, listening to all frequency bins that register above a threshold.

It makes bytes from the tone, and then calls back with a message.

## Usage

The example is a great place to start

[example](./example)

```
var modem = require('../modem');

// Start listening
modem.demodulate(function(error, message){
    // We got a message! :D

    // Currently it  can't error..
});

modem.modulate('Hello world!');

```

You can encode all characters in the range from 1 to 255, which is probably enough.

I may eventually supporting packet sizes up to 64bit, if it works..