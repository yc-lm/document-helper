/**
 * @name: date.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
// 获取常用时间
const dayjs = require('dayjs');
const duration = require('dayjs/plugin/duration');


const FORMAT_TYPE = {
  TYPE_YMD_DIR: 'YYYY/MM/DD',
  TYPE_YMD_HMS_FULL: 'YYYYMMDD_HHmmss',
  TYPE_YMD_FULL: 'YYYYMMDD',
  TYPE_YMD_NO_DIVIDER: 'YYYYMMDD',
  TYPE_YMD: 'YYYY-MM-DD',
  TYPE_YMD_HMS: 'YYYY-MM-DD HH:mm:ss',
  TYPE_HMS: 'HH:mm:ss',
  TYPE_HMS_CHINESE: 'HH时mm分ss秒',
  TYPE_MS: 'mm:ss',
  TYPE_MS_CHINESE: 'mm分ss秒',
  TYPE_SS: 'ss',
  TYPE_SS_CHINESE: 'ss秒',
};
dayjs.extend(duration);

/**
 * 获取当前时间戳
 * @param {boolean} unix 是否返回unix时间戳
 */
function getCurrentTimeInt(unix = true) {
  return unix ? dayjs().unix() : dayjs().valueOf();
}

/**
 * 封装格式化时间的方法
 * @param {object|string|number} date 传入的日期
 * @param {string} format 格式
 * @return string
 */
function formatDateTime(date, format = FORMAT_TYPE.TYPE_YMD_HMS) {
  // 检查是否已经是一个 dayjs 对象
  if (!(date instanceof dayjs)) {
    // 如果是时间戳，直接使用 dayjs 解析
    if (typeof date === 'number') {
      const isUnix = date.toString()?.length < 13;
      date = isUnix ? dayjs.unix(date) : dayjs(date);
    } else if (typeof date === 'string') {
      // 自动判断字符串是否是 ISO 格式，然后解析
      date = dayjs(date);
    } else {
      // 如果是 Date 对象，使用 dayjs 包装
      date = dayjs(date);
    }
  }
  // 使用 format 方法进行格式化
  return date.format(format);
}

/**
 * 基于指定时间增加|减少指定天数
 * @param {object|string|number|null} date 传入的日期
 * @param {number} addTime 传入的日期
 * @param {string|undefined} addUnit 增加时间类型
 * @param {string} format 格式
 * @return string
 */
function addSpecificDate(date, addTime = 0, addUnit = 'day', format = FORMAT_TYPE.TYPE_YMD) {
  // 直接返回
  if (!addTime && addTime !== 0) {
    return date;
  }

  // 直接返回当前日期
  if (addTime === 0) {
    return date || dayjs(getCurrentTimeInt(false)).format(format);
  }

  if (!date) {
    date = getCurrentTimeInt(false);
  }
  // 创建一个指定时间的日期对象，例如 '2023-01-01'
  const specificDate = dayjs(date);
  console.log('specificDate', specificDate);
  // 增加 10 天 或者 减少
  // 判断是增加或者减少
  const isAdd = addTime > 0;
  const futureDate = isAdd ? specificDate.add(addTime, addUnit) : specificDate.subtract(Math.abs(addTime), addUnit);

  return futureDate.format(format);
}

module.exports = {
  FORMAT_TYPE,
  getCurrentTimeInt,
  formatDateTime,
  addSpecificDate,
};
