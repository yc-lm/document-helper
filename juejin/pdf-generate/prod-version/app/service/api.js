/**
 * @name: api.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const Service = require('egg').Service;
const stringHelper = require('../extend/string');
const fileHelper = require('../extend/fileHelper');
const dateHelper = require('../extend/date');
const puppeteer = require('puppeteer');
class ApiService extends Service {

  // 生成名称
  generateFileNameAndPath(tempPath, fullUrl) {
    const ext = '.pdf';
    // 根据当前请求生成文件名
    let uniqueName = stringHelper.md5(fullUrl);
    const timePath = dateHelper.formatDateTime(dateHelper.getCurrentTimeInt(false), dateHelper.FORMAT_TYPE.TYPE_YMD);

    // 当前路径
    const currentPath = fileHelper.join(tempPath, timePath);
    fileHelper.createDirectory(currentPath);
    const filenameWithExt = `${uniqueName}${ext}`;
    const filePath = fileHelper.join(currentPath, filenameWithExt);
    return { uniqueName: filenameWithExt, filePath };
  }


  // 生成pdf
  async createPdf(pdfParams = {}) {
    const { fullUrl, filePath, authKey, authValue, completeTag, config } = pdfParams;
    // 是否有footer
    const footerTip = config?.footerTip || '课堂报告';
    const margin = config.margin || 20;

    const browser = await puppeteer.launch({
      args: [
        '--ignore-certificate-errors', // 忽略证书错误
        '--no-sandbox',
      ],
    });
    const page = await browser.newPage();
    // await page.setBypassCSP(false);
    if (authKey && authValue) {
      await page.setExtraHTTPHeaders({
        [`${authKey}`]: authValue,
      });
    }

    // 打开url
    await page.mainFrame().goto(fullUrl);

    // 等待渲染成功的标识元素出现
    await page.waitForSelector(completeTag);

    // 导出pdf
    await page.pdf({
      path: filePath,
      displayHeaderFooter: false,
      footerTemplate: `<p>${footerTip}</p>`,
      format: 'A4',
      preferCSSPageSize: false,
      printBackground: true,
      margin: {
        top: `${margin}`,
        bottom: `${margin}`,
      },
    });
    // page.close()
    await browser.close();
  }

}

module.exports = ApiService;