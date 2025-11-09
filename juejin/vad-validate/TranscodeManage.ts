/**
 * @name: TranscodeManage.ts
 * @author: yangcongcong
 * @date: 2024/9/13
 * @description: 转码相关功能
 */
import EventEmitter from 'eventemitter3';
import isFunction from 'lodash/isFunction';

import { CdnAssets } from '@/config/cdnAssets';
import { TranscodeErrorType, TranscodeEventCollection } from '@/utils/ffmpeg/ffmpegEvent';
import { FFmpeg } from '@/utils/ffmpeg/src/ffmpeg/index.js';
import { fetchFile, toBlobURL } from '@/utils/ffmpeg/src/util/index.js';
import { ExtractAudioOptions } from '@/utils/media/validate';
import { getFileExtension } from '@/utils/upload/multipart';

class TranscodeManage extends EventEmitter {
  config = {};

  ffmpeg = null;

  isLoaded = false; // 核心库是否已经加载

  constructor(config = {}) {
    super();
    Object.assign(this.config, config);
    this.ffmpeg = new FFmpeg();
    console.log('TranscodeManage', this.ffmpeg);
  }

  load = async () => {
    try {
      // toBlobURL is used to bypass CORS issue, urls with the same
      // domain can be used directly.
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${CdnAssets.ffmpegCore}`, 'text/javascript'),
        wasmURL: await toBlobURL(`${CdnAssets.ffmpegWasm}`, 'application/wasm'),
        workerURL: await toBlobURL(`${CdnAssets.ffmpegWorker}`, 'text/javascript'),
      });
      console.log('ffmpeg', this.ffmpeg);
      this.isLoaded = true;
      this.emit(TranscodeEventCollection.LOAD_CORE_SUCCESS);
    } catch (err) {
      console.log(err);
      this.emit(TranscodeEventCollection.ERROR, TranscodeErrorType.LOAD_CORE_ERROR);
    }
  };

  /**
   * 将其他格式的音频转为mp3格式
   * @param {string | File | Blob} file 文件
   * @param {string} sourceExt 源文件的后缀
   */
  transcodeMp3 = async (file, sourceExt) => {
    try {
      // 原始文件名
      const sourceName = `input.${sourceExt}`;
      const targetName = 'output.mp3';
      await this.ffmpeg.writeFile(sourceName, await fetchFile(file));
      await this.ffmpeg.exec(['-i', sourceName, targetName]);
      const data = await this.ffmpeg.readFile(targetName);
      // blobData
      const blobData = new Blob([data.buffer], { type: 'audio/mp3' });

      this.emit(TranscodeEventCollection.TRANSCODE_END_DATA, blobData);
    } catch (err) {
      console.log(err);
      this.emit(TranscodeEventCollection.ERROR, TranscodeErrorType.TRANSCODE_ERROR);
    }
  };

  /**
   * 从视频中读取mp3
   * @param {string | File | Blob} file 文件
   */
  extractAudio = async (file) => {
    try {
      await this.ffmpeg.writeFile('input.mp4', await fetchFile(file));

      await this.ffmpeg.exec(['-i', 'input.mp4', '-map', '0:a', '-c:a', 'libmp3lame', 'output.mp3']);

      const data = await this.ffmpeg.readFile('output.mp3');
      // blobData
      const blobData = new Blob([data.buffer], { type: 'audio/mp3' });

      this.emit(TranscodeEventCollection.TRANSCODE_END_DATA, blobData);
    } catch (err) {
      console.log(err);
      this.emit(TranscodeEventCollection.ERROR, TranscodeErrorType.TRANSCODE_ERROR);
    }
  };

  /**
   * 提取适合silero-vad检测的音频数据 (16kHz 单声道)
   * @param {string | File | Blob} file 输入文件
   * @param {object} options
   * @returns {Promise<ArrayBuffer>} 返回音频数据的ArrayBuffer
   */
  extractWav = async (file, options: ExtractAudioOptions) => {
    // 记录开始时间
    const startTime = performance.now();

    const { startTimeStr, durationStr, metaCallback } = options;
    this.log('Loading ffmpeg.wasm...');
    if (!this.isLoaded) await this.load();
    this.log('ffmpeg loaded');
    this.log(`ffmpeg options：startTimeStr(${startTimeStr}),durationStr(${durationStr})`);

    const { inputName, outputName } = this.generateUniqueFileName(file, '.raw');

    this.log(`Writing ${inputName} to ffmpeg FS`);
    await this.ffmpeg.writeFile(inputName, await fetchFile(file.raw));

    // 临时添加日志监听器来捕获元数据
    const logHandler = (event: UnknowValue) => {
      const msg = event.message;
      this.log(msg);
      if (metaCallback && isFunction(metaCallback)) {
        const metaInfo = this.parseMetadata(msg);
        if (metaInfo && metaInfo.length) {
          // @ts-ignore
          metaCallback(metaInfo);
        }
      }
    };
    this.ffmpeg.on('log', logHandler);

    // 转换为 16k 单声道 Float32Array 格式
    this.log('Running ffmpeg to extract audio (16k Float32Array)...');
    // -ar 16000 : sample rate 16000
    // -ac 1 : mono (单声道)
    // -f f32le : 输出32位浮点小端格式
    // -acodec pcm_f32le : 使用pcm_f32le编解码器
    await this.ffmpeg.exec([
      '-i',
      inputName,
      '-ss',
      startTimeStr, // 开始时间
      '-t',
      durationStr, // 持续时间
      '-vn', // 移除视频流
      '-acodec',
      'pcm_f32le', // 指定音频编解码器为32位浮点格式
      '-ar',
      '16000', // 采样率16kHz
      '-ac',
      '1', // 单声道
      '-f',
      'f32le', // 输出格式为32位浮点小端格式
      outputName,
    ]);
    this.log('ffmpeg run finished');

    const data = await this.ffmpeg.readFile(outputName);

    // 计算并记录执行时间
    const endTime = performance.now();
    const executionTime = (endTime - startTime) / 1000; // 转换为秒
    this.log(`extractWav execution time: ${executionTime.toFixed(2)} seconds`);
    this.ffmpeg.off('log', logHandler); // 移除日志监听器

    // 清理资源
    this.ffmpeg.deleteFile(inputName); // 删除虚拟文件
    this.ffmpeg.deleteFile(outputName);

    // 返回 ArrayBuffer 格式
    return data.buffer;
  };

  /**
   * 提取音视频中的格式信息
   * @param {string | File | Blob} file 文件
   * @returns {Promise<any>} 返回解析后的元数据
   *
   * 时长信息标识：Duration: 00:00:05.04, start: 0.000000, bitrate: 1438 kb/s
   * 视频信息标识：Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1280x720 [SAR 27:26 DAR 24:13], 1353 kb/s, 25 fps, 25 tbr, 12800 tbn (default)
   * 音频信息标识：Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 79 kb/s (default)
   */
  extractMetadata = async (file) => {
    try {
      this.log('Loading ffmpeg.wasm...');
      if (!this.isLoaded) await this.load();
      this.log('ffmpeg loaded');

      const { inputName } = this.generateUniqueFileName(file);

      // 创建 Promise 来捕获元数据信息
      const metadataPromise = new Promise((resolve, reject) => {
        const logs: string[] = [];
        const logHandler = (event: UnknowValue) => {
          this.log(event.message);
          logs.push(event.message);
          // FFmpeg 在执行 -i 命令时如果没有输出文件会报错，但会输出我们需要的元数据
          if (event.message.includes('At least one output file must be specified')) {
            // 解析并返回元数据
            const metadataText = logs.join('\n');
            const parsedMetadata = this.parseMetadata(metadataText);
            // 移除监听器
            this.ffmpeg.off('log', logHandler);
            resolve(parsedMetadata);
          }
        };

        // 临时添加日志监听器来捕获元数据
        this.ffmpeg.on('log', logHandler);

        // 超时处理
        setTimeout(() => {
          this.ffmpeg.off('log', logHandler);
          reject();
        }, 60 * 1000);
      });

      // 将文件写入FFmpeg文件系统
      await this.ffmpeg.writeFile(inputName, await fetchFile(file.raw));
      // 执行FFmpeg命令触发元数据提取
      await this.ffmpeg.exec(['-i', inputName]);
      // 等待并返回解析后的元数据
      const metadata = await metadataPromise;
      return metadata;
    } catch (err) {
      return [];
    }
  };

  // 生成唯一input or output文件名
  generateUniqueFileName(file, outputExt = null) {
    const inputExt = getFileExtension(file);
    const randomId = Math.random().toString(36).substring(2, 15);

    const inputName = `input_${randomId}${inputExt}`;
    const outputName = `output_${randomId}${outputExt || inputExt}`;
    return { inputName, outputName };
  }

  // 解析元数据文本
  parseMetadata(metadataText) {
    const result = [];

    const lines = metadataText.split('\n');

    for (let line of lines) {
      line = line.trim();

      if (!line) continue;

      // 解析视频信息
      // 匹配: Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(progressive), 1280x720 [SAR 27:26 DAR 24:13], 1353 kb/s, 25 fps, 25 tbr, 12800 tbn (default)
      const videoMatch = line.match(/Stream #\d+:\d+.*?: Video: ([^,]+)/);
      if (videoMatch) {
        result.push({
          type: 'video',
          value: videoMatch[1].trim(),
        });
        continue;
      }

      // 解析音频信息
      // 匹配: Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 48000 Hz, stereo, fltp, 79 kb/s (default)
      // 排除输出流（通常没有方括号内的标识符）
      const audioMatch = line.match(/Stream #\d+:\d+\[[^\]]+\].*?: Audio: ([^,]+)/);
      if (audioMatch) {
        result.push({
          type: 'audio',
          value: audioMatch[1].trim(),
        });
        continue;
      }

      // 解析时长信息
      // 匹配: Duration: 00:00:05.04, start: 0.000000, bitrate: 1438 kb/s
      const durationMatch = line.match(/Duration: ([\d:.]+)/);
      if (durationMatch) {
        result.push({
          type: 'duration',
          value: this.timeToSecondsSimple(durationMatch[1].trim()),
        });
        continue;
      }
    }

    return result;
  }

  // 简化版本，只处理到秒
  timeToSecondsSimple(timeString: string): number {
    const parts = timeString.split(':');
    if (parts.length !== 3) {
      return 0;
    }

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * 终止所有任务
   */
  cancelTask = () => {
    this.ffmpeg.terminate();
  };

  log(str: string) {
    console.log(str);
  }
}

export default TranscodeManage;
