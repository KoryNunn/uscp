var encdec = require('./encdec'),
    encode = encdec.encode,
    decode = encdec.decode,
    minFrequency = 19000,
    maxFrequency = 21000,
    frameTime = 90;

var audioContext = new (AudioContext || webkitAudioContext)();

var channelCache = {};

function getChannel(audioContext, frequency, frameTime){
    if(channelCache[frequency]){
        return channelCache[frequency];
    }

    var gainNode = audioContext.createGain(),
        gainOn = 1/32;
    // Gain => Merger

    gainNode.gain.value = 0;

    gainNode.connect(audioContext.destination);

    var osc = audioContext.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(gainNode);

    osc.start(0 / 1000);



    channelCache[frequency] = function(on, startTime){
        // gainNode.gain.setValueAtTime(on ? gainOn : 0, startTime / 1000);
        // gainNode.gain.setValueAtTime(0, (startTime + frameTime / 2) / 1000);


        gainNode.gain.setValueAtTime(0, (startTime) / 1000);

        var toneTime = frameTime;

        if(on){
            gainNode.gain.linearRampToValueAtTime(gainOn, (startTime + 2) / 1000);
            gainNode.gain.setValueAtTime(gainOn, (startTime + toneTime - 2) / 1000);
            gainNode.gain.linearRampToValueAtTime(0, (startTime + toneTime) / 1000);
        }
    };

    return channelCache[frequency];
}

function sendPacket(audioContext, minFrequency, maxFrequency, packets){
    var firstPacket = packets[0];

    if(!firstPacket){
        return;
    }

    var packetSize = firstPacket.length;
        frequencyStep = (maxFrequency - minFrequency) / packetSize,
        startTime = (audioContext.currentTime * 1000);

    var channels = firstPacket.map(function(packet, index){
        return getChannel(audioContext, minFrequency + frequencyStep * index, frameTime);
    });

    packets.forEach(function(packet, packetIndex){
        packet.forEach(function(bit, bitIndex){
            var value = parseInt(bit),
                time = startTime + (packetIndex * frameTime);

            channels[bitIndex](value, time);
        });
    });
}

function modulate(input){
    sendPacket(audioContext, minFrequency, maxFrequency, encode(input));
}

function connectInputStream(analyser){
    var constraints = {
        audio: { optional: [{ echoCancellation: false }] }
      };

    navigator.webkitGetUserMedia(
        constraints,
        function(stream){

            var input = audioContext.createMediaStreamSource(stream);

            input.connect(analyser);

        },
        function(error){
            console.log(error);
        }
    );
}

function demodulate(callback){
    var analyser = audioContext.createAnalyser(),
        nyqist = audioContext.sampleRate / 2;

    connectInputStream(analyser);

    analyser.fftSize = 2048;

    var bufferLength = analyser.frequencyBinCount;

    var dataArray = new Float32Array(bufferLength);

    var dataBuffer = [];

    var frequencyRange = nyqist / bufferLength;

    var currentBits,
        frameStart = Date.now();

    function listen(){
        analyser.getFloatFrequencyData(dataArray);

        var freqBinRange = Array.prototype.slice.call(dataArray, minFrequency / frequencyRange, maxFrequency / frequencyRange);


        var bits = [],
            anyData;

        while(bits.length < 8){
            var bit = freqBinRange[Math.round(bits.length * (freqBinRange.length / 8))] > -55 ? 1 : 0;
            bits.push(bit);
            if(bit){
                anyData = true;
            }
        }

        var now = Date.now();

        if(anyData){
            if(!currentBits){
                frameStart = now;
                currentBits = [];
            }

            currentBits.push(bits);
        }else if(currentBits){
            var packetTime = now - frameStart,
                packetLength = Math.floor(packetTime / frameTime),
                frameBitLength = Math.floor(currentBits.length / packetLength);

            for(var i = 0; i < packetLength; i++){
                dataBuffer.push(
                    currentBits
                    .slice(
                        Math.floor(i * frameBitLength) + 1,
                        Math.floor(i * frameBitLength + frameBitLength) - 1
                    )
                    .reduce(function(result, bits){
                        bits.map(function(value, index){
                            result[index] += value
                        });
                        return result;
                    }, [0,0,0,0,0,0,0,0])
                    .map(function(value){
                        return Math.round(value / frameBitLength);
                    })
                );

            }


            if(dataBuffer.length){
                callback(null, decode(dataBuffer));
                dataBuffer = [];
            }
            currentBits = null;
        }


    }

    setInterval(listen);
}

module.exports = {
    modulate: modulate,
    demodulate: demodulate
};