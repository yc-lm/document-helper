/**
 * @name: app.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const fileHelper = require('./app/extend/fileHelper');
class AppBootHook {
  constructor(app) {
    this.app = app;
  }

  serverDidReady() {
    // 去创建临时目录
    const folderPath = fileHelper.join(this.app.baseDir, this.app.config.tempPathName);
    fileHelper.createDirectory(folderPath);
  }
}

module.exports = AppBootHook;
