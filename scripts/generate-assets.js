import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

// 1. Generate PNG using pure JS (uncompressed PNG with zlib DEFLATE)
function createPng(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth 8
  ihdrData.writeUInt8(6, 9); // RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw image data with filter byte per scanline
  const stride = width * 4 + 1;
  const rawData = Buffer.alloc(height * stride);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * stride;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      // Draw a circular badge with dark green background and golden bird color
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = width * 0.45;

      if (dist < radius) {
        // Inner circle
        if (dist > radius - 8) {
          // Border
          rawData[pxOffset] = 103; // R
          rawData[pxOffset + 1] = 164; // G
          rawData[pxOffset + 2] = 119; // B
          rawData[pxOffset + 3] = 255; // A
        } else {
          // Bird shape check approx
          const isBird = (x > width * 0.35 && x < width * 0.75 && y > height * 0.35 && y < height * 0.65);
          if (isBird) {
            rawData[pxOffset] = 217;
            rawData[pxOffset + 1] = 119;
            rawData[pxOffset + 2] = 6;
            rawData[pxOffset + 3] = 255;
          } else {
            rawData[pxOffset] = 31;
            rawData[pxOffset + 1] = 57;
            rawData[pxOffset + 2] = 39;
            rawData[pxOffset + 3] = 255;
          }
        }
      } else {
        // Transparent outside
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressed);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

const table = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  table[i] = c;
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type, 'ascii');
  const typeAndData = Buffer.concat([typeBuf, data]);

  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crcBuf]);
}

// 2. Generate standard 16kHz mono WAV audio clips with synthesized bird call acoustics
function generateBirdSongWav(speciesName, durationSec = 3.0) {
  const sampleRate = 16000;
  const numSamples = Math.floor(sampleRate * durationSec);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22); // NumChannels (1 mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32); // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;

    if (speciesName === 'American Robin') {
      // Cheerful rising and falling syllables (2.5 kHz to 4.5 kHz)
      const phrase = Math.floor(t * 3) % 2;
      const tInPhrase = (t * 3) % 1.0;
      if (tInPhrase < 0.6) {
        const freq = 2800 + 1200 * Math.sin(tInPhrase * Math.PI * 6);
        const env = Math.sin(tInPhrase / 0.6 * Math.PI);
        sample = 0.6 * Math.sin(2 * Math.PI * freq * t) * env;
      }
    } else if (speciesName === 'Song Sparrow') {
      // 3 fast introductory notes followed by a buzz and trill (3.5 kHz to 6 kHz)
      const noteIdx = Math.floor(t * 4);
      const noteTime = (t * 4) % 1.0;
      if (noteTime < 0.4) {
        const freq = 3800 + noteIdx * 400 + 500 * Math.sin(noteTime * 20);
        const env = Math.sin(noteTime / 0.4 * Math.PI);
        sample = 0.5 * Math.sin(2 * Math.PI * freq * t) * env;
      }
    } else if (speciesName === 'Mourning Dove') {
      // Soft, hollow, rhythmic coo-OO-oo (400 Hz to 700 Hz)
      const tMod = t % 1.5;
      if (tMod < 0.9) {
        const freq = 480 + 120 * Math.sin(tMod * 2 * Math.PI);
        const env = Math.sin(tMod / 0.9 * Math.PI);
        sample = 0.7 * Math.sin(2 * Math.PI * freq * t) * env;
      }
    } else if (speciesName === 'Barn Owl') {
      // Raspy hissing shriek / screech (2 kHz to 5 kHz white noise modulated)
      const tMod = t % 1.8;
      if (tMod < 1.0) {
        const noise = (Math.random() * 2 - 1);
        const carrier = Math.sin(2 * Math.PI * 3200 * t);
        const env = Math.sin(tMod / 1.0 * Math.PI);
        sample = 0.5 * (noise * 0.7 + carrier * 0.3) * env;
      }
    } else {
      // Generic bird chirp
      const freq = 3500 + 1000 * Math.sin(t * 12);
      sample = 0.5 * Math.sin(2 * Math.PI * freq * t);
    }

    const intVal = Math.max(-32767, Math.min(32767, Math.floor(sample * 32767)));
    buffer.writeInt16LE(intVal, 44 + i * 2);
  }

  return buffer;
}

// Generate Icons
const icon192 = createPng(192, 192, 31, 57, 39);
fs.writeFileSync('public/icons/icon-192x192.png', icon192);

const icon512 = createPng(512, 512, 31, 57, 39);
fs.writeFileSync('public/icons/icon-512x512.png', icon512);

// Generate Sample Audio
fs.mkdirSync('public/samples', { recursive: true });
const speciesSamples = [
  'American Robin',
  'Song Sparrow',
  'Mourning Dove',
  'Barn Owl',
];

for (const species of speciesSamples) {
  const filename = species.toLowerCase().replace(/\s+/g, '-') + '.wav';
  const wavBuf = generateBirdSongWav(species, 3.0);
  fs.writeFileSync(path.join('public/samples', filename), wavBuf);
  console.log(`Generated sample: public/samples/${filename}`);
}

console.log('Generated PNG icons and sample audio files.');
