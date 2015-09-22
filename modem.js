var encdec = require('./encdec'),
    audioContext = new (AudioContext || webkitAudioContext)(),
    encode = encdec.encode,
    decode = encdec.decode,
    sampleRate = audioContext.sampleRate,
    intSize = 8,
    nyqist = sampleRate / 2,
    fftSize = 1024,
    freqencyBinStep = sampleRate / fftSize,
    binsPerStep = fftSize / (intSize * 2),
    frequenciesPerBin = fftSize / binsPerStep,
    maxFrequency = Math.floor(sampleRate / 2 - (freqencyBinStep * 64)),
    minFrequency = Math.floor(maxFrequency - (freqencyBinStep * binsPerStep)),
    frequencyRange = maxFrequency - minFrequency,
    frequencyStep = frequencyRange / intSize,
    carrierFrequency = maxFrequency + frequencyStep,
    frameTime = 150;

console.log(minFrequency, maxFrequency);

var channelCache = {};

gainTable = [1/32, 1/20, 1/8, 1/4, 1/4, 1/8, 1/8, 1/4, 1/4];

function getChannel(audioContext, frequency, frameTime, gainIndex){
    if(channelCache[frequency]){
        return channelCache[frequency];
    }

    var gainNode = audioContext.createGain(),
        gainOn = gainTable[gainIndex];
    // Gain => Merger

    gainNode.gain.value = 0;

    gainNode.connect(audioContext.destination);

    var osc = audioContext.createOscillator();
    osc.frequency.value = frequency;
    osc.connect(gainNode);

    osc.start(0 / 1000);

    channelCache[frequency] = function(on, startTime){

        gainNode.gain.setValueAtTime(0, (startTime) / 1000);

        var toneTime = frameTime,
            rampTime = 20;

        if(on){
            gainNode.gain.linearRampToValueAtTime(gainOn, (startTime + rampTime) / 1000);
            gainNode.gain.setValueAtTime(gainOn, (startTime + toneTime - rampTime) / 1000);
            gainNode.gain.linearRampToValueAtTime(0, (startTime + toneTime) / 1000);
        }
    };

    return channelCache[frequency];
}

function sendPacket(channels, packet, time){
    packet.forEach(function(bit, bitIndex){
        var value = parseInt(bit);

        channels[bitIndex](value, time);
    });
}

function sendPackets(channels, packets, startTime, frameTime){
    packets.forEach(function(packet, packetIndex){
        var time = startTime + (packetIndex * frameTime);

        getChannel(audioContext, carrierFrequency, frameTime, channels.length)(1, time);

        sendPacket(channels, packet, time);
    });
}

function modulate(input, callback){
    if(!callback){
        callback = function(){};
    }

    var packets = encode(input),
        header = encode(Math.ceil(packets.length / 8) + ':'),
        firstPacket = packets[0];

    if(!firstPacket){
        return;
    }

    var startTime = (audioContext.currentTime * 1000);

    var channels = firstPacket.map(function(packet, index){
        return getChannel(audioContext, Math.floor(minFrequency + frequencyStep * index), frameTime, index);
    });

    sendPackets(channels, header, startTime, frameTime);

    var frameIndex = 0,
        headerTime = (header.length * frameTime);

    while(packets.length){

        sendPackets(
            channels,
            packets.splice(0, 8),

            startTime +
            headerTime +
            (frameIndex * 9 * frameTime) +
            frameTime,

            frameTime
        );
        frameIndex++;
    }

    setTimeout(callback,
        (
            headerTime +
            (frameIndex * 9 * frameTime)
        )
    );
}

function connectInputStream(analyser){
    var constraints = {
        audio: { optional: [{
            echoCancellation: false
        }] }
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

function demodulate(callback, fftFrameCallback){
    var analyser = audioContext.createAnalyser();

    connectInputStream(analyser);

    analyser.fftSize = fftSize;

    var bufferLength = analyser.frequencyBinCount;

    var dataArray = new Float32Array(bufferLength);

    var dataBuffer = [];

    var binRange = nyqist / bufferLength;

    var currentBits,
        frameStart = Date.now(),
        frameCount = null,
        message = '';

    function listen(){
        analyser.getFloatFrequencyData(dataArray);

        var freqBinRange = Array.prototype.slice.call(dataArray, minFrequency / binRange, maxFrequency / binRange),
            range = freqBinRange.reduce(function(result, value){
                result[0] = Math.min(result[0], value);
                result[1] = Math.max(result[1], value);
                return result;
            }, [Infinity, -Infinity]),
            carrierValue = dataArray[Math.floor(carrierFrequency / binRange)],
            emptyValue = dataArray[Math.floor(((carrierFrequency - maxFrequency) / 2 + maxFrequency) / binRange)]
            minValue = range[0],
            maxValue = range[1],
            threshold = minValue + (maxValue - emptyValue);

        console.log(threshold, emptyValue, minValue, maxValue);

        // console.log(
        //     freqBinRange.reduce(function(result, value){
        //         return result + ' ' + Math.floor(-value / 12);
        //     }, ''),
        //     freqBinRange.reduce(function(result, value){
        //         result[0] = Math.min(result[0], Math.floor(-value / 12));
        //         result[1] = Math.max(result[1], Math.floor(-value / 12));
        //         return result;
        //     }, [Infinity, -Infinity])
        // );

        var bits = [],
            carrierValue = dataArray[Math.floor(carrierFrequency / binRange)],
            anyData = carrierValue > threshold;

        for(var i = 0; i < intSize; i++){
            var bitIndex = Math.floor(freqBinRange.length / 8 * i),
                value = freqBinRange[bitIndex],
                bit = value > threshold ? 1 : 0;

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
                frameBitLength = Math.floor(currentBits.length / packetLength),
                leadTime = frameBitLength / 3; // Jump a quarter frame in.

            for(var i = 0; i < packetLength; i++){
                dataBuffer.push(
                    currentBits
                    .slice(
                        Math.floor(i * frameBitLength + leadTime),
                        Math.floor(i * frameBitLength + frameBitLength - leadTime)
                    )
                    .reduce(function(result, bits){
                        bits.map(function(value, index){
                            result[index] += value
                        });
                        return result;
                    }, [0,0,0,0,0,0,0,0])
                    .map(function(value){
                        return Math.round(value / (frameBitLength - leadTime * 2));
                    })
                );

            }


            if(dataBuffer.length){
                var frameValue = decode(dataBuffer);

                if(frameCount === null){
                    var headerMatch = frameValue.match(/([0-9]+):/);
                    if(headerMatch){
                        frameCount = parseInt(headerMatch[1]);
                    }
                }else{
                    frameCount--;
                    message += frameValue;
                }

                if(frameCount === 0){
                    callback(null, message);
                    message = '';
                    frameCount = null;
                }

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