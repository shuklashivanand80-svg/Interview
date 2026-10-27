/**
 * Create a valid Windows ICO file from a PNG file.
 * ICO format: header + directory + PNG data (PNG embedded ICO)
 * Windows Vista+ supports PNG-embedded ICO files natively.
 */
const fs = require('fs')
const path = require('path')

const srcPng = path.resolve(__dirname, 'public/logo.png')
const outIco = path.resolve(__dirname, 'public/logo.ico')

const pngData = fs.readFileSync(srcPng)

// ICO format with single embedded PNG entry
// ICONDIR header: reserved(2) + type(2) + count(2) = 6 bytes
// ICONDIRENTRY: width(1) + height(1) + colorCount(1) + reserved(1) + planes(2) + bitCount(2) + sizeInBytes(4) + imageOffset(4) = 16 bytes
// Total header: 6 + 16 = 22 bytes

const icoHeader = Buffer.alloc(6)
icoHeader.writeUInt16LE(0, 0)       // Reserved, must be 0
icoHeader.writeUInt16LE(1, 2)       // Type: 1 = ICO
icoHeader.writeUInt16LE(1, 4)       // Image count: 1

const iconDirEntry = Buffer.alloc(16)
iconDirEntry.writeUInt8(0, 0)        // Width: 0 = 256
iconDirEntry.writeUInt8(0, 1)        // Height: 0 = 256
iconDirEntry.writeUInt8(0, 2)        // Color count: 0 = 256+
iconDirEntry.writeUInt8(0, 3)        // Reserved
iconDirEntry.writeUInt16LE(1, 4)     // Planes: 1
iconDirEntry.writeUInt16LE(32, 6)    // Bit count: 32 bpp
iconDirEntry.writeUInt32LE(pngData.length, 8)   // Size of image data
iconDirEntry.writeUInt32LE(22, 12)   // Offset of image data (after header + entry)

const icoBuffer = Buffer.concat([icoHeader, iconDirEntry, pngData])
fs.writeFileSync(outIco, icoBuffer)

const sizekB = (icoBuffer.length / 1024).toFixed(1)
console.log(`✅ Created logo.ico (${sizekB}KB) with embedded PNG`)
console.log(`   Path: ${outIco}`)
