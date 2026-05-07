const tls = require('tls');
const net = require('net');

const HOST = 'imap.hostinger.com';
const PORT = 993;

console.log(`1. Testing pure TCP connection to ${HOST}:${PORT}...`);

const socket = new net.Socket();
socket.setTimeout(5000);

socket.on('connect', () => {
    console.log('   [SUCCESS] TCP Connection established.');
    socket.destroy();
    testTLS();
});

socket.on('timeout', () => {
    console.log('   [FAILED] TCP Connection timed out.');
    socket.destroy();
});

socket.on('error', (err) => {
    console.log(`   [FAILED] TCP Connection error: ${err.message}`);
});

socket.connect(PORT, HOST);

function testTLS() {
    console.log(`\n2. Testing TLS Handshake to ${HOST}:${PORT}...`);
    const options = {
        host: HOST,
        port: PORT,
        rejectUnauthorized: false
    };

    const tlsSocket = tls.connect(options, () => {
        console.log('   [SUCCESS] TLS Handshake completed.');
        console.log('   Cipher:', tlsSocket.getCipher());
        tlsSocket.end();
    });

    tlsSocket.setTimeout(5000);

    tlsSocket.on('timeout', () => {
        console.log('   [FAILED] TLS Handshake timed out.');
        tlsSocket.destroy();
    });

    tlsSocket.on('error', (err) => {
        console.log(`   [FAILED] TLS error: ${err.message}`);
    });
}
