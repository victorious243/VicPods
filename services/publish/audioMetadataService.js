const fs = require('fs/promises');
const {
  buildStoredAudioAbsolutePath,
  readStoredAudioBuffer,
} = require('./audioStorageService');

const MPEG_VERSION_BY_BITS = {
  0: '2.5',
  2: '2',
  3: '1',
};

const MPEG_LAYER_BY_BITS = {
  1: 'III',
  2: 'II',
  3: 'I',
};

const BITRATE_TABLES = {
  '1-I': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  '1-II': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  '1-III': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  '2-I': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2-II': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2-III': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2.5-I': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  '2.5-II': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
  '2.5-III': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};

const SAMPLE_RATES = {
  '1': [44100, 48000, 32000],
  '2': [22050, 24000, 16000],
  '2.5': [11025, 12000, 8000],
};

const CHANNEL_MODES = ['stereo', 'joint_stereo', 'dual_channel', 'mono'];

function readSynchsafeInteger(buffer, startIndex) {
  return (
    ((buffer[startIndex] & 0x7f) << 21)
    | ((buffer[startIndex + 1] & 0x7f) << 14)
    | ((buffer[startIndex + 2] & 0x7f) << 7)
    | (buffer[startIndex + 3] & 0x7f)
  );
}

function getAudioPayloadOffset(buffer) {
  if (buffer.length < 10 || buffer.subarray(0, 3).toString('ascii') !== 'ID3') {
    return 0;
  }

  const footerPresent = (buffer[5] & 0x10) === 0x10;
  const tagSize = readSynchsafeInteger(buffer, 6);
  return Math.min(buffer.length, 10 + tagSize + (footerPresent ? 10 : 0));
}

function parseMpegFrameHeader(buffer, offset) {
  if (offset + 4 > buffer.length) {
    return null;
  }

  const header = buffer.readUInt32BE(offset) >>> 0;
  if (((header & 0xffe00000) >>> 0) !== 0xffe00000) {
    return null;
  }

  const versionBits = (header >> 19) & 0x3;
  const layerBits = (header >> 17) & 0x3;
  const bitrateIndex = (header >> 12) & 0xf;
  const sampleRateIndex = (header >> 10) & 0x3;
  const paddingBit = (header >> 9) & 0x1;
  const channelBits = (header >> 6) & 0x3;

  const mpegVersion = MPEG_VERSION_BY_BITS[versionBits];
  const mpegLayer = MPEG_LAYER_BY_BITS[layerBits];

  if (!mpegVersion || !mpegLayer || bitrateIndex === 0 || bitrateIndex === 0xf || sampleRateIndex === 0x3) {
    return null;
  }

  const bitrateKbps = BITRATE_TABLES[`${mpegVersion}-${mpegLayer}`]?.[bitrateIndex] || 0;
  const sampleRateHz = SAMPLE_RATES[mpegVersion]?.[sampleRateIndex] || 0;

  if (!bitrateKbps || !sampleRateHz) {
    return null;
  }

  let samplesPerFrame = 1152;
  if (mpegLayer === 'I') {
    samplesPerFrame = 384;
  } else if (mpegLayer === 'III' && mpegVersion !== '1') {
    samplesPerFrame = 576;
  }

  let frameLengthBytes = 0;
  if (mpegLayer === 'I') {
    frameLengthBytes = Math.floor(((12 * bitrateKbps * 1000) / sampleRateHz) + paddingBit) * 4;
  } else if (mpegLayer === 'III' && mpegVersion !== '1') {
    frameLengthBytes = Math.floor(((72 * bitrateKbps * 1000) / sampleRateHz) + paddingBit);
  } else {
    frameLengthBytes = Math.floor(((144 * bitrateKbps * 1000) / sampleRateHz) + paddingBit);
  }

  return {
    offset,
    bitrateKbps,
    sampleRateHz,
    frameLengthBytes,
    samplesPerFrame,
    mpegVersion,
    mpegLayer,
    channelMode: CHANNEL_MODES[channelBits] || 'unknown',
  };
}

function findFirstMpegFrame(buffer, startOffset = 0) {
  for (let index = Math.max(0, startOffset); index <= buffer.length - 4; index += 1) {
    const frame = parseMpegFrameHeader(buffer, index);
    if (frame) {
      return frame;
    }
  }

  return null;
}

function normalizeDurationSeconds(value) {
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  return Math.max(1, Math.round(value));
}

function extractAudioMetadataFromBuffer(buffer, { mimeType = 'audio/mpeg' } = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) {
    throw new Error('Audio metadata extraction needs a non-empty MP3 buffer.');
  }

  const audioPayloadOffset = getAudioPayloadOffset(buffer);
  const firstFrame = findFirstMpegFrame(buffer, audioPayloadOffset);

  if (!firstFrame) {
    throw new Error('Could not find a readable MP3 frame header.');
  }

  const audioByteLength = Math.max(0, buffer.length - firstFrame.offset);
  const estimatedDurationSeconds = firstFrame.bitrateKbps
    ? normalizeDurationSeconds((audioByteLength * 8) / (firstFrame.bitrateKbps * 1000))
    : null;

  return {
    mimeType,
    byteSize: buffer.length,
    audioPayloadOffset,
    audioByteLength,
    durationSeconds: estimatedDurationSeconds,
    bitrateKbps: firstFrame.bitrateKbps,
    sampleRateHz: firstFrame.sampleRateHz,
    frameLengthBytes: firstFrame.frameLengthBytes,
    samplesPerFrame: firstFrame.samplesPerFrame,
    mpegVersion: firstFrame.mpegVersion,
    mpegLayer: firstFrame.mpegLayer,
    channelMode: firstFrame.channelMode,
  };
}

async function extractAudioMetadataFromFile(absolutePath, options = {}) {
  const buffer = await fs.readFile(absolutePath);
  return extractAudioMetadataFromBuffer(buffer, options);
}

async function extractAudioMetadataFromStorageKey(storageKey, options = {}) {
  const buffer = await readStoredAudioBuffer(storageKey);
  return extractAudioMetadataFromBuffer(buffer, options);
}

module.exports = {
  extractAudioMetadataFromBuffer,
  extractAudioMetadataFromFile,
  extractAudioMetadataFromStorageKey,
  findFirstMpegFrame,
  getAudioPayloadOffset,
  parseMpegFrameHeader,
};
