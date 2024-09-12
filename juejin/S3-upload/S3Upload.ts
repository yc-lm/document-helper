/**
 * @name: S3Upload.ts
 * @author: yangcongcong
 * @date: 2024/9/2
 * @description: 基于s3协议的上传
 */
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import EventEmitter from 'eventemitter3';
import pLimit from 'p-limit';

import { CHUNK_PART_SIZE, EXPIRE_TIME, PARALLEL_NUMBER } from '@/config/file';
import { FORMAT_TYPE, formatDateTime, getCurrentTimeInt } from '@/utils/date';
import { sort2DArray } from '@/utils/object';
import { calculateTotalChunks, getStsTokenCache, MULTI_UPLOAD_EVENT, sliceFile } from '@/utils/upload/multipart';
import { AbortInfoField, PutObjectCommandField } from '@/utils/upload/upload';

class S3Upload extends EventEmitter {
  logPrefix = 'S3Upload';

  // 上传配置
  config = {
    basePath: '',
    region: '',
    bucket: '',
    endpoint: '',
    signUrlExpireTime: EXPIRE_TIME,
  };

  ossClient = null;

  constructor(config = {}) {
    super();
    // 配置覆盖
    Object.assign(this.config, config);
    this.log('constructor', this.config);
  }

  /**
   * 获取上传实例
   * @return Promise<object>
   */
  async getInstance() {
    const { securityToken, accessKeyId, accessKeySecret } = await getStsTokenCache();
    // @ts-ignore
    this.ossClient = new S3Client({
      region: this.config.region,
      endpoint: this.config.endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey: accessKeySecret,
        sessionToken: securityToken,
      },
    });

    return this.ossClient;
  }

  /**
   * 获取上传文件路径
   * @param {object} file 文件对象
   * @return string
   */
  getUploadFileName(file) {
    // 前缀
    const baseFileArr = [this.config.basePath];

    // 拼接年月日后缀
    const currentInt = getCurrentTimeInt();
    const yearDir = formatDateTime(currentInt, FORMAT_TYPE.TYPE_YMD_DIR);
    baseFileArr.push(yearDir);

    // 文件名称
    baseFileArr.push(file.name);
    return baseFileArr.join('/');
  }

  /**
   * 普通上传
   * @param {object} file 文件对象
   * @return Promise<object>
   */
  async uploadFile(file) {
    const originalName = file.name;
    try {
      const fileName = this.getUploadFileName(file);

      const raw = file.raw || file;
      // 当前桶
      const currentBucket = this.config.bucket;
      // @ts-ignore
      const command = this.basePutObjectCommand({
        // 填写Bucket名称。
        Bucket: currentBucket,
        // 填写OSS文件完整路径和本地文件的完整路径。OSS文件完整路径中不能包含Bucket名称。
        Key: fileName,
        // 指定文件内容或Buffer。
        Body: raw,
        // meta信息，非必选
        Metadata: {
          filePath: encodeURI(fileName),
          bucket: currentBucket,
        },
      });
      const result = await this.ossClient.send(command);
      this.log('uploadFile:ok', result);
      // 返回格式适配t-design的upload组件
      return { status: 'success', response: { url: this.mockCompleteUrl(fileName) }, originalName };
    } catch (error) {
      this.log('uploadFile:error', error);
      return { status: 'fail', error: '上传失败', originalError: error, response: { url: '' }, originalName };
    }
  }

  /**
   * 返回完成的地址
   */
  mockCompleteUrl(fileName) {
    // `https://${this.config.bucket}.${this.config.region}.aliyuncs.com/${encodeURI(fileName)}`;
    return `${this.config.endpoint}/${encodeURI(fileName)}`;
  }

  /**
   * 分片上传
   * @param {object} file 文件对象
   * @return Promise<object>
   */
  async multipartUpload(file) {
    try {
      // 当前桶
      const currentBucket = this.config.bucket;
      // 文件名
      const fileName = this.getUploadFileName(file);
      // 上传任务
      const multipartUploadResult = await this.ossClient.send(
        this.baseCreateMultipartUploadCommand(currentBucket, fileName),
      );
      const uploadId = multipartUploadResult.UploadId;

      // 触发生成uploadId事件
      this.emit(MULTI_UPLOAD_EVENT.UPLOAD_ID, { uploadId, fileName });

      // 生成所有分片promise
      const uploadPromises = await this.mockChunkUploadPromise(file, { currentBucket, fileName, uploadId });
      const uploadResults = await Promise.all(uploadPromises);

      // 所有分片信息
      const partsInfo = uploadResults.map(({ ETag, PartNumber }) => ({
        ETag,
        PartNumber: Number(PartNumber),
      }));
      // 合成
      const completePartCommand = this.baseCompleteMultipartUploadCommand(currentBucket, fileName, uploadId, partsInfo);
      const res = await this.ossClient.send(completePartCommand);
      // 触发完成
      this.emit(MULTI_UPLOAD_EVENT.UPLOAD_PROGRESS, 1);
      this.log('multipartUpload:ok', res);
      return { status: 'success', response: { url: res.Location }, originalName: file.name };
    } catch (error) {
      this.log('multipartUpload:error', error);
      return { status: 'fail', error: '上传失败', originalError: error, response: {}, originalName: file.name };
    }
  }

  /**
   * 断点续传（追加上传）
   * @param {object} file 文件对象
   * @param {object} abortInfo 断点续传
   * @param {string} abortInfo.breakUploadId 本次上传id
   * @param {string} abortInfo.breakKey 上传路径
   * @return Promise<object>
   */
  async breakPointResume(file, abortInfo: AbortInfoField) {
    try {
      // 初始化断点信息
      const breakKey = abortInfo?.breakKey || '';
      const breakUploadId = abortInfo?.breakUploadId || '';

      // 当前桶
      const currentBucket = this.config.bucket;
      // 如果是断点续传，直接使用记录的名称
      const fileName = breakKey;
      // 如果是断点续传，不重新生成id
      const uploadId = breakUploadId;

      // 断点信息：获取已经上传的片段
      const abortPartInfo = await this.getMultiPartList(breakUploadId, breakKey);
      // 生成所有分片promise
      const uploadPromises = await this.mockChunkUploadPromise(
        file,
        { currentBucket, fileName, uploadId },
        abortPartInfo,
      );
      const uploadResults = await Promise.all(uploadPromises);
      // 合并当前完成的和之前完成的，用于最后一步合成文件
      const partsInfo = this.mergePartInfo(uploadResults, abortPartInfo);
      // 合成
      const completePartCommand = this.baseCompleteMultipartUploadCommand(currentBucket, fileName, uploadId, partsInfo);
      const res = await this.ossClient.send(completePartCommand);
      // 触发完成
      this.emit(MULTI_UPLOAD_EVENT.UPLOAD_PROGRESS, 1);
      this.log('breakPointResume:ok', res);
      return { status: 'success', response: { url: res.Location }, originalName: file.name };
    } catch (error) {
      this.log('breakPointResume:error', error);
      return { status: 'fail', error: '上传失败', originalError: error, response: {}, originalName: file.name };
    }
  }

  /**
   * 生成切片上传promise集合
   * @param {object} file 文件对象
   * @param {object} partCommandInfo 上传分片需要的参数
   * @param {string} partCommandInfo.currentBucket
   * @param {string} partCommandInfo.fileName
   * @param {string} partCommandInfo.uploadId
   * @param {array} abortPartInfo 断点续传时会使用到
   * @return Promise<array>
   */
  async mockChunkUploadPromise(file, partCommandInfo, abortPartInfo = []) {
    // 上传分片需要的参数
    const { currentBucket, fileName, uploadId } = partCommandInfo;
    // 计算分片数量
    const totalChunks = calculateTotalChunks(file, CHUNK_PART_SIZE);
    const uploadPromises = [];
    // 成功数量
    let successNumber = abortPartInfo?.length || 0;
    // 限制并发数量
    const limit = pLimit(PARALLEL_NUMBER);

    // Upload each part.
    for (let i = 0; i < totalChunks; i++) {
      // 计算当前分片的起始和结束位置
      const start = i * CHUNK_PART_SIZE;
      const end = Math.min(start + CHUNK_PART_SIZE, file.size);

      const chunk = await sliceFile(file.raw, start, end);

      // 当前分片number
      const tempPartNumber = i + 1;

      // 判断当前是否已经上传过：断点续传时跳过已经上传成功的
      if (abortPartInfo.some((item) => `${item.PartNumber}` === `${tempPartNumber}`)) {
        continue;
      }
      // 上传命令
      const uploadPartCommand = this.baseUploadPartCommand(currentBucket, fileName, uploadId, chunk, tempPartNumber);

      uploadPromises.push(
        limit(() =>
          this.ossClient.send(uploadPartCommand).then((d) => {
            this.log(`Part ${i + 1} uploaded`, d);
            // 触发进度事件
            successNumber += 1;
            // 模拟生成进度算法：所有分片上传占用90%；合成10%；完成一个分片时的进度(successNumber / totalChunks) * 0.9
            this.emit(MULTI_UPLOAD_EVENT.UPLOAD_PROGRESS, (successNumber / totalChunks) * 0.9);
            return { ...d, PartNumber: tempPartNumber };
          }),
        ),
      );
    }
    return uploadPromises;
  }

  /**
   * 合并分片信息，并按照切片顺序排序
   * @param {array} uploadResult 当前上传完成的信息
   * @param {array} abortPartInfo 中断之前已经上传的信息
   * @return array
   */
  mergePartInfo(uploadResult = [], abortPartInfo = []) {
    const list = uploadResult.concat(abortPartInfo);
    return sort2DArray(
      list.map(({ ETag, PartNumber }) => ({
        ETag,
        PartNumber: Number(PartNumber),
      })),
      'PartNumber',
      true,
    );
  }

  /**
   * 取消分片上传
   * @param {string} uploadId 上传id
   * @param {string} key 存储路径
   * @return Promise<void>
   */
  async abortMultipartUpload(uploadId, key) {
    if (uploadId) {
      const abortCommand = this.baseAbortMultipartUploadCommand(this.config.bucket, key, uploadId);
      await this.ossClient.send(abortCommand);
    } else {
      this.log('abortMultipartUpload:error', 'no uploadId');
    }
  }

  /**
   * 获取分片上传信息
   * @param {string} uploadId 上传id
   * @param {string} key 存储路径
   * @return Promise<array>
   */
  async getMultiPartList(uploadId, key) {
    try {
      let result = [];
      if (!uploadId) {
        return result;
      }
      const listCommand = this.baseListPartsCommand(this.config.bucket, key, uploadId);
      result = await this.ossClient.send(listCommand);
      this.log('getMultiPartList:ok', result);
      return result?.Parts || [];
    } catch (err) {
      this.log('getMultiPartList:error', err);
      return [];
    }
  }

  /**
   * 基础方法-预签名文件
   * @param {string} key 存储路径
   * @param {boolean} isEndPoint 是否为完成的地址
   * @return Promise<string>
   */
  async createPreSignedUrlWithClient(key, isEndPoint = false) {
    try {
      // 携带了endpoint
      if (isEndPoint) {
        key = key.replace(`${this.config.endpoint}/`, '');
      }

      const command = this.basePutObjectCommand({ Bucket: this.config.bucket, Key: key });
      const result = await getSignedUrl(this.ossClient, command, { expiresIn: this.config.signUrlExpireTime });
      this.log('createPreSignedUrlWithClient:ok', result);
      return result;
    } catch (err) {
      this.log('createPreSignedUrlWithClient:error', err);
      return '';
    }
  }

  /**
   * 基础命令-生成分片上传任务
   * @param {string} bucket 桶
   * @param {string} key 存储路径
   * @return object
   */
  baseCreateMultipartUploadCommand(bucket, key) {
    return new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
    });
  }

  /**
   * 基础命令-上传分片
   * @param {string} bucket 桶
   * @param {string} key 存储路径
   * @param {string} uploadId 上传id
   * @param {buffer} chunk 切片数据
   * @param {number} tempPartNumber 切片number
   * @return object
   */
  baseUploadPartCommand(bucket, key, uploadId, chunk, tempPartNumber) {
    return new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      Body: chunk,
      PartNumber: tempPartNumber,
    });
  }

  /**
   * 基础命令-合成分片
   * @param {string} bucket 桶
   * @param {string} key 存储路径
   * @param {string} uploadId 上传id
   * @param {array} partsInfo 切片数据
   * @return object
   *
   * partsInfo格式信息：
   * [{ETag: '"EF64BB0A7689214E08D108B1EB76B642"', PartNumber: 1},...]
   */
  baseCompleteMultipartUploadCommand(bucket, key, uploadId, partsInfo) {
    return new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: partsInfo,
      },
    });
  }

  /**
   * 基础命令-PutObjectCommand通用
   * @param {object} input 输入对象信息
   * @param {string} input.Bucket 桶
   * @param {string} input.key 存储路径
   * @return object
   */
  basePutObjectCommand(input: PutObjectCommandField) {
    return new PutObjectCommand(input);
  }

  /**
   * 基础命令-取消分片上传
   * @param {string} bucket 桶
   * @param {string} key 存储路径
   * @param {string} uploadId 上传id
   * @return object
   */
  baseAbortMultipartUploadCommand(bucket, key, uploadId) {
    return new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });
  }

  /**
   * 基础命令-获取当前任务已经上传的分片信息
   * @param {string} bucket 桶
   * @param {string} key 存储路径
   * @param {string} uploadId 上传id
   * @return object
   */
  baseListPartsCommand(bucket, key, uploadId) {
    return new ListPartsCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
    });
  }

  log(subKey, info = {}) {
    console.log(`${this.logPrefix}, ${subKey}, ====>`, JSON.stringify(info));
  }
}

export default S3Upload;
