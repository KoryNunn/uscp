var padding = '00000000000000000000000000000000';
function encode(string, maxBits){
    if(!maxBits){
        maxBits = 8;
    }
    return string.split('').map(function(char){
        return (padding.slice(0, maxBits) + char.charCodeAt(0).toString(2)).slice(-maxBits).split('');
    });
}

function decode(packet){
    return packet.map(function(bits) {
        return String.fromCharCode(parseInt(bits.join(''), 2));
    }).join('');
};

module.exports = {
    encode: encode,
    decode: decode
};