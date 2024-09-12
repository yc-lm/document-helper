/**
 * @name: upload.d.ts
 * @author: yangcongcong
 * @date: 2024/9/11
 * @description: 定义上传相关的类型
 */

/**
 * basePath: "report",//上传目录前缀：
 * region: "oss-cn-beijing",
 * bucket: "ai-analysis-test",
 * endpoint:"http://oss-cn-beijing.aliyuncs.com",
 * documentUploadMaxSize：104857600 // 文档上传大小限制
 * audioUploadMaxSize： 6442450944 // 音频上传大小限制
 * videoUploadMaxSize： 6442450944 // 音频上传大小限制
 */
export interface UploadConfigField {
  basePath: string;
  region: string;
  bucket: string;
  endpoint: string;
  documentUploadMaxSize?: number;
  audioUploadMaxSize?: number;
  videoUploadMaxSize?: number;
}

export interface AbortInfoField {
  breakUploadId?: string;
  breakKey?: string;
}

export interface PutObjectCommandField {
  Bucket: string;
  Key: string;
  Body?: any;
  Metadata?: {
    [T: string]: any;
  };
}
