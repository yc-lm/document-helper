/**
 * @name: fileTask.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const Subscription = require('egg').Subscription;
const fileHelper = require('../extend/fileHelper');
const dateHelper = require('../extend/date');

class DailyTask extends Subscription {
  // 通过 schedule 属性来设置定时任务的执行间隔等配置
  static get schedule() {
    return {
      // interval: '1m', // 1 分钟间隔
      cron: '0 2 * * *', // 凌晨执行
      type: 'worker', // 某一个 worker执行
    };
  }

  // subscribe 是真正定时任务执行时被运行的函数
  async subscribe() {
    // 删除前一天的
    const prevDay = dateHelper.addSpecificDate(null, 0);
    fileHelper.deleteDirectory(fileHelper.join(this.app.config.tempPathName, prevDay));
  }
}

module.exports = DailyTask;
