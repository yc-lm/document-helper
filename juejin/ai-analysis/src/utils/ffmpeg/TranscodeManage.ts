/**
 * @name: TranscodeManage.ts
 * @author: yangcongcong
 * @date: 2025/05/13
 * @description: 转码相关功能
 */
import { FFmpeg } from '@ffmpeg/ffmpeg';
import type { LogEvent } from '@ffmpeg/ffmpeg/dist/esm/types';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import EventEmitter from 'eventemitter3';

import { TranscodeErrorType, TranscodeEventCollection } from './ffmpegEvent';

class TranscodeManage extends EventEmitter {
  config = {};

  ffmpeg = null;

  isLoaded = false; // 核心库是否已经加载

  constructor(config = {}) {
    super();
    Object.assign(this.config, config);
    this.ffmpeg = new FFmpeg();
  }

  load = async () => {
    try {
      const baseURL = '/wasm'; // 本地加载
      this.ffmpeg.on('log', ({ message: msg }: LogEvent) => {
        console.log('msg', msg);
      });
      this.ffmpeg.on('progress', ({ progress }: LogEvent) => {
        this.emit(TranscodeEventCollection.PROGRESS, progress);
      });
      // toBlobURL is used to bypass CORS issue, urls with the same
      // domain can be used directly.
      await this.ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      this.isLoaded = true;
      this.emit(TranscodeEventCollection.LOAD_CORE_SUCCESS);
    } catch (err) {
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
      this.emit(TranscodeEventCollection.ERROR, TranscodeErrorType.TRANSCODE_ERROR);
    }
  };

  /**
   * 终止所有任务
   */
  cancelTask = () => {
    this.ffmpeg.terminate();
  };
}

export default TranscodeManage;
