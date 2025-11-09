/**
 * @project    lesson-analysis-pro
 * @author     yangcongcong
 * @date       2025/10/10 15:15
 * @description 非实时语音检测
 * @license    MIT
 * @copyright  (c) 2025
 */
import EventEmitter from 'eventemitter3';
import { v4 as uuidv4 } from 'uuid';

import { CdnAssets } from '@/config/cdnAssets';
import { VIDEO_CODEC_SUPPORT_INFO } from '@/config/file';
import { ValidateErrorInfo } from '@/types/upload';
import { formatDurationTime } from '@/utils/date';
import TranscodeManage from '@/utils/ffmpeg/TranscodeManage';
import { MediaMetadata } from '@/utils/media/validate';
import {
  MEDIA_AUDIO_EFFECTIVE_DURATION,
  MEDIA_AUDIO_TOTAL_DURATION,
  VALIDATE_MP4_EVENT,
} from '@/utils/upload/multipart';
import { NonRealTimeVAD } from '@/utils/vad/v5/non-real-time-vad';

export default class NotRealTimeValidate extends EventEmitter {
  ffmpegUtil = null; // 转码工具

  debugObj = null;

  logPrefix = 'NotRealTimeValidate';

  supportedVideoFormats = [];

  supportedAudioFormats = [];

  // 检测流程中各方法进度的占比
  actionProportion = {
    firstExtract: 50, // 第一轮提取
    otherExtract: 10, // 之后每一轮
    detectSpeechSegments: 40,
  };

  constructor() {
    super();
    this.ffmpegUtil = new TranscodeManage();
    this.supportedVideoFormats = VIDEO_CODEC_SUPPORT_INFO.mp4.video;
    this.supportedAudioFormats = VIDEO_CODEC_SUPPORT_INFO.mp4.audio;
  }

  /**
   * 验证媒体文件并提取元数据信息
   * @param file - 要验证的媒体文件，可以是 File 或 Blob 对象
   * @returns Promise<MediaMetadata[]> 返回解析后的媒体文件元数据信息数组，每个元素包含：
   *   - type: 元数据类型 ('video' | 'audio' | 'duration')
   *   - value: 对应的元数据值
   * @throws 当文件格式不支持或提取过程出错时抛出异常
   */
  async getMediaMetaData(file: File | Blob): Promise<MediaMetadata[]> {
    const metadata = await this.ffmpegUtil.extractMetadata(file);
    return metadata;
  }

  /**
   * 验证音视频
   */
  /**
   * 验证音视频
   */
  async detectAudioEffective(file: File | Blob): Promise<{ valid: boolean; errorInfo: ValidateErrorInfo[] }> {
    const actionId = file?.name || uuidv4();
    const startTime = performance.now();
    this.emit(VALIDATE_MP4_EVENT.VALIDATE_START); // 开始事件
    this.log('Validation started', { actionId });
    const sampleRate = 16000;

    // 记录开始时间
    const currentMetaData: MediaMetadata[] = [];
    let effectiveDuration = 0; // 单位毫秒
    let duration = 0; // 总时长,单位秒
    let extractStart = 0;
    const extractDuration = 300; // 5分钟

    // 1.执行第一次提取音频数据
    const getMetadata = (metaInfo: MediaMetadata[]) => {
      console.log('getMetadata', metaInfo);
      // 使用currentMetaData将每次的metaInfo存起来
      currentMetaData.push(...metaInfo);

      // 获取总时长
      const durationInfo = metaInfo?.find((item: MediaMetadata) => item.type === 'duration');
      if (durationInfo) {
        duration = durationInfo.value;
        this.log('Audio duration detection', duration);
      }

      // 每次都触发
      this.emit(VALIDATE_MP4_EVENT.VALIDATE_METADATA, currentMetaData);
    };

    const metadataProgress = this.mockProgress(0, this.actionProportion.firstExtract, (progress) => {
      this.emit(VALIDATE_MP4_EVENT.VALIDATE_PROGRESS, progress);
    });
    metadataProgress.start();

    // 计算第一次实际应该提取的时长
    const startTimeStr = this.secondsToTimeFormat(extractStart);
    const durationStr = this.secondsToTimeFormat(extractDuration);
    const tryBuffer = await this.ffmpegUtil.extractWav(file, {
      startTimeStr,
      durationStr,
      metaCallback: getMetadata,
    });

    // 执行成功后，更新开始时间
    const firstActualDuration = Math.min(duration, extractDuration);
    extractStart += firstActualDuration;
    metadataProgress.finish(); // 触发10%进度

    // 2.验证总时长
    const validDurationInfo = this.checkTotalDuration(currentMetaData);
    this.log('Total duration validation completed', { actionId, valid: validDurationInfo.valid });
    if (!validDurationInfo.valid) {
      const endTime = performance.now();
      this.log(`Total validation time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
      return validDurationInfo;
    }

    const tryAudio = new Float32Array(tryBuffer);
    const validEffectiveInfo = await this.detectSpeechSegments(tryAudio, sampleRate); // 检测音频有效性
    this.log(`${startTimeStr} Audio detection completed`, { actionId, validEffectiveInfo });

    effectiveDuration += validEffectiveInfo.fragmentDuration;
    this.log('effectiveDuration update', effectiveDuration);

    // 如果第一次检测不满足，继续向后检测
    if (!validEffectiveInfo.valid) {
      // 在 while 循环中添加进度控制
      let currentProgress = 50; // 初始进度(前序步骤已完成)
      const maxProgress = 100; // 最大进度
      const progressIncrement = 5; // 每轮增量

      // 循环处理后续片段
      this.log('first validEffectiveInfo error, start while', { extractStart, duration });
      while (extractStart < duration) {
        // 计算实际提取时长，避免超出总时长
        const actualDuration = Math.min(extractDuration, duration - extractStart);

        const nextStartTimeStr = this.secondsToTimeFormat(extractStart);
        const nextDurationStr = this.secondsToTimeFormat(actualDuration);

        const fragmentBuffer = await this.ffmpegUtil.extractWav(file, {
          startTimeStr: nextStartTimeStr,
          durationStr: nextDurationStr,
        });
        currentProgress = Math.min(currentProgress + progressIncrement, maxProgress);
        this.emit(VALIDATE_MP4_EVENT.VALIDATE_PROGRESS, currentProgress);
        const fragmentAudio = new Float32Array(fragmentBuffer);

        const fragmentEffectiveInfo = await this.detectSpeechSegments(fragmentAudio, sampleRate, effectiveDuration);
        this.log(`${startTimeStr} Audio detection completed`, { fragmentEffectiveInfo });
        effectiveDuration = fragmentEffectiveInfo.fragmentDuration; // 更新有效时长
        this.log('effectiveDuration update', effectiveDuration);

        currentProgress = Math.min(currentProgress + progressIncrement, maxProgress);
        this.emit(VALIDATE_MP4_EVENT.VALIDATE_PROGRESS, currentProgress);

        if (fragmentEffectiveInfo.valid) {
          break;
        }
        // 更新开始时间
        extractStart += actualDuration;
      }
    }

    // 所有检测完成，都不满足
    if (effectiveDuration <= MEDIA_AUDIO_EFFECTIVE_DURATION * 1000) {
      const endTime = performance.now();
      this.log(`Total validation time: ${((endTime - startTime) / 1000).toFixed(2)}s`);
      return {
        valid: false,
        errorInfo: [
          {
            errorMessage: `音频有效时长不足，当前时长（${formatDurationTime({ time: effectiveDuration, isChinese: true })}）`,
            type: 'error',
          },
        ],
      };
    }

    // 记录总耗时
    const endTime = performance.now();
    console.log(`[NotRealTimeValidate] Total validation time: ${((endTime - startTime) / 1000).toFixed(2)}s`);

    return { valid: true, errorInfo: [] };
  }

  // 将秒数转换为 HH:MM:SS 格式
  secondsToTimeFormat(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return [String(hours).padStart(2, '0'), String(minutes).padStart(2, '0'), String(secs).padStart(2, '0')].join(':');
  }

  /**
   * 打印日志信息
   * @param message 日志消息
   * @param data 可选的附加数据
   */
  private log(message: string, data?: any): void {
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const logMessage = `[${this.logPrefix}] ${timestamp} - ${message}`;

    if (data !== undefined) {
      console.log(logMessage, data);
    } else {
      console.log(logMessage);
    }
  }

  /**
   * 模拟进度的通用方法
   * @param currentProgress 当前进度起点
   * @param totalProportion 该任务在总进度中的占比
   * @param callback 进度更新回调函数
   * @returns 包含开始和结束方法的对象
   */
  private mockProgress(currentProgress: number, totalProportion: number, callback: (progress: number) => void) {
    let intervalId = null;
    // 生成0.8到0.9之间的随机系数，保留两位小数
    const randomFactor = Math.round((Math.random() * 0.1 + 0.8) * 100) / 100;
    // 计算目标进度（总占比的90%）
    const targetProgress = currentProgress + totalProportion * randomFactor;
    // 保存初始进度值
    let progress = currentProgress;

    const start = () => {
      intervalId = window.setInterval(() => {
        if (progress < targetProgress) {
          progress += 1;
          callback(Math.floor(progress));
        } else if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
      }, 50); // 每50毫秒更新一次进度
    };

    const finish = () => {
      // 清理定时器
      if (intervalId) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      // 直接设置为当前进度加上总占比
      callback(currentProgress + totalProportion);
    };

    return { start, finish };
  }

  /**
   * 判断是否为H264格式的视频
   * @param info 媒体元素据解析结果
   * @returns 是否为H264格式
   */
  isH264Format(info: MediaMetadata): boolean {
    const videoFormat = info?.value;
    return this.supportedVideoFormats.some((tempFormat) => videoFormat?.includes(tempFormat));
  }

  /**
   * 提取音视频中的音频为单通道wav格式音频
   */
  async extractAudio(file: File | Blob): Promise<ArrayBuffer> {
    const wavBuffer = await this.ffmpegUtil.extractWav(file);
    return wavBuffer;
  }

  /**
   * 检测有效时长
   */
  detectSpeechSegments = async (
    float32Audio,
    sampleRate,
    totalDuration: number = 0,
  ): Promise<{ valid: boolean; fragmentDuration: number }> => {
    let fragmentDuration = totalDuration; // 之前已经检测的时长
    let validFlag = false;
    const modelPath = `${CdnAssets.onnxSileroVadV5}`;
    const vadOptions = {
      modelURL: modelPath,
      ortConfig: (ort) => {
        ort.env.wasm.wasmPaths = {
          wasm: `${CdnAssets.ortWasmSimdWasm}`,
          mjs: `${CdnAssets.ortWasmSimdThreaded}`,
        };
      },
    };

    const myvad = await NonRealTimeVAD.new(vadOptions).catch((err) => {
      console.error('VAD初始化失败:', err);
      throw err;
    });

    console.log('VAD初始化成功', myvad);

    // fragmentDuration > 10000ms时，自动停止检测
    for await (const seg of myvad.run(float32Audio, sampleRate)) {
      console.log(seg);
      fragmentDuration += seg.end - seg.start;
      if (fragmentDuration > MEDIA_AUDIO_EFFECTIVE_DURATION * 1000) {
        console.log('已超过100秒，自动停止检测');
        validFlag = true;
        break;
      }
    }

    return {
      valid: validFlag,
      fragmentDuration,
    };
  };

  /**
   * 检测音频总时长是否足够
   */
  checkTotalDuration(info: MediaMetadata[]): { valid: boolean; errorInfo: ValidateErrorInfo[] } {
    let audioValid = false;
    const errorInfo: ValidateErrorInfo[] = [];

    const durationInfo = info?.find((item: MediaMetadata) => item.type === 'duration') || {};
    if (durationInfo && Object.keys(durationInfo).length) {
      // 计算音频时长（单位：秒）
      const audioDuration = durationInfo.value;
      // 验证音频时长是否不低于 5 分钟（300 秒）
      audioValid = audioDuration >= MEDIA_AUDIO_TOTAL_DURATION;
      if (!audioValid) {
        errorInfo.push({
          errorMessage: `总时长低于5分钟，当前时长（${formatDurationTime({ time: audioDuration * 1000, isChinese: true })}）`,
          type: 'error',
        });
      }
    } else {
      errorInfo.push({ errorMessage: '获取总时长信息失败', type: 'error' });
    }

    return {
      valid: audioValid,
      errorInfo,
    };
  }
}
