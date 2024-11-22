/**
 * @name: app.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const fileHelper = require('./app/extend/fileHelper');
const initPuppeteerPool = require('./app/extend/genericPool');

class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  async didLoad() {
    // 所有的配置已经加载完毕
    // 可以用来加载应用自定义的文件，启动自定义的服务
    this.app.pool = initPuppeteerPool({
      puppeteerArgs: {
        args: [
          '--ignore-certificate-errors', // 忽略证书错误
          '--no-sandbox',
        ],
      },
    });
  }

  serverDidReady() {
    // 去创建临时目录
    const folderPath = fileHelper.join(this.app.baseDir, this.app.config.tempPathName);
    fileHelper.createDirectory(folderPath);
  }

  async beforeClose() {
    // 释放资源
    if (this.app.pool.drain) {
      await this.app.pool.drain().then(() => this.app.pool.clear());
    }
  }
}

module.exports = AppBootHook;
