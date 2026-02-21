const { parseHeader } = require('./parsers/header');

const testBuf = Buffer.alloc(29);
testBuf.writeUInt16LE(2025, 0);
testBuf.writeUInt8(25, 2);
testBuf.writeUInt8(1, 3);
testBuf.writeUInt8(0, 4);
testBuf.writeUInt8(1, 5);
testBuf.writeUInt8(2, 6);

const header = parseHeader(testBuf);
console.log('Header parseado:', header);
console.log('✅ Parser funcionando si no hay errores');
