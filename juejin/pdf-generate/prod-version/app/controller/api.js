/**
 * @name: api.js
 * @author: yangcongcong
 * @date: 2024/9/23
 * @description: 描述
 */
const { Controller } = require('egg');
const fileHelper = require('../extend/fileHelper');

class ApiController extends Controller {
  async index() {
    const { ctx } = this;
    const fullUrl = ctx.query.fullUrl;// 完成url，包含id等信息
    const friendlyName = ctx.query.friendlyName || '';// 友好名，用于下载
    const authKey = ctx.query.authKey || ''; // 需要设置的请求头
    const authValue = ctx.query.authValue || ''; // 需要设置的请求头
    const completeTag = ctx.query.completeTag || '.is-rendered-tag';
    const config = ctx.config || {}; // 其他配置项


    let error = '';
    // 验证
    if (!fullUrl) {
      error = 'fullUrl is required';
    }

    if (!completeTag) {
      error = 'completeTag is required';
    }

    if (error) {
      ctx.body = error;
      return false;
    }

    // 根据当前请求生成文件名
    const { filePath, uniqueName } = ctx.service.api.generateFileNameAndPath(this.app.config.tempPathName, fullUrl);

    // 生成pdf
    await ctx.service.api.createPdf({
      fullUrl,
      filePath,
      authKey,
      authValue,
      completeTag,
      config,
    });

    // 读取文件流
    const file = fileHelper.readStream(filePath);
    ctx.set('Content-disposition', 'attachment;filename=' +
      encodeURIComponent(friendlyName ? friendlyName : uniqueName));
    ctx.set('Content-type', 'application/pdf');
    ctx.body = file;
  }
}

module.exports = ApiController;
