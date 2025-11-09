/**
 * @project    lesson-analysis-pro
 * @author     yangcongcong
 * @date       2025/10/10 9:03
 * @description
 * @license    MIT
 * @copyright  (c) 2025
 */

/**
 * 将音频 ArrayBuffer 数据转换为单声道 Float32Array 格式
 *
 * @param arrayBuffer - 音频文件的 ArrayBuffer 数据
 * @returns 包含音频数据和采样率的对象
 * @throws 当音频解码失败时抛出错误
 *
 * @example
 * const audioData = await fetch('audio.wav').then(res => res.arrayBuffer());
 * const { audio, sampleRate } = await audioBufferToArray(audioData);
 */
export async function audioBufferToArray(arrayBuffer: ArrayBuffer) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));

    const out = new Float32Array(audioBuffer.length);
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let j = 0; j < audioBuffer.numberOfChannels; j++) {
        out[i] += audioBuffer.getChannelData(j)[i];
      }
    }

    ctx.close?.();
    return { audio: out, sampleRate: audioBuffer.sampleRate };
  } catch (err) {
    ctx.close?.();
    throw err;
  }
}

/**
 * 将PCM音频数据编码为WAV格式文件
 *
 * @param {Int16Array} samples - PCM音频数据数组
 * @param {number} sampleRate - 音频采样率，默认16000Hz
 * @returns {ArrayBuffer} WAV格式的音频数据
 *
 * @description
 * 按照WAV文件格式标准创建包含完整文件头信息和音频数据的二进制数据
 * 文件头包含RIFF标识、文件大小、音频格式、采样率等元数据信息
 *
 * @example
 * const pcmData = new Int16Array(audioBuffer);
 * const wavBuffer = encodeWAV(pcmData, 16000);
 * const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });
 */
export const encodeWAV = (samples: Int16Array, sampleRate: number): ArrayBuffer => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV文件头
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // 音频格式 (1 = PCM)
  view.setUint16(22, 1, true); // 声道数
  view.setUint32(24, sampleRate, true); // 采样率
  view.setUint32(28, sampleRate * 2, true); // 字节率
  view.setUint16(32, 2, true); // 块对齐
  view.setUint16(34, 16, true); // 位深度
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true); // 数据块大小

  // 写入PCM数据
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    view.setInt16(offset, samples[i], true);
  }

  return buffer;
};

/**
 * 将PCM音频数据转换为WAV格式的Blob对象
 *
 * @param {ArrayBuffer} pcmData - PCM音频数据缓冲区
 * @param {number} sampleRate - 音频采样率，默认16000Hz
 * @returns {Blob} WAV格式的音频Blob对象
 *
 * @description
 * 该函数将原始PCM音频数据包装成完整的WAV格式文件
 * 首先将ArrayBuffer转换为Int16Array格式，然后通过encodeWAV函数添加WAV文件头
 * 最终返回可直接用于播放或上传的WAV格式Blob对象
 *
 * @example
 * const pcmBuffer = combinePcmData();
 * const wavBlob = convertPcmToWav(pcmBuffer, 16000);
 * // 可用于音频播放或文件上传
 */
export const convertPcmToWav = (pcmData: ArrayBuffer, sampleRate: number = 16000): Blob => {
  const pcmView = new Int16Array(pcmData);
  const wavBuffer = encodeWAV(pcmView, sampleRate);
  return new Blob([wavBuffer], { type: 'audio/wav' });
};
