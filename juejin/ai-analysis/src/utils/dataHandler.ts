// 处理段落数据
import { isObject } from 'lodash';

/** 处理段落数据
 * @param {string} data 段落数据
 * @returns {array} 处理后的数据
 */
export function handleParagraphData(data: string) {
  // 定义正则表达式
  const regex = /```json([\s\S]*?)```/;
  // 执行匹配
  const match = data.match(regex);

  if (match && match[1]) {
    try {
      // 提取匹配到的 JSON 字符串并去除首尾空白字符
      const extractedJsonString = match[1].trim();
      // 将 JSON 字符串解析为对象
      const resultObj = JSON.parse(extractedJsonString);
      if (isObject(resultObj)) {
        return Object.values(resultObj);
      }
      return [];
    } catch (error) {
      console.error('解析 JSON 数据时出错:', error);
      return [];
    }
  } else {
    console.log('未找到符合条件的 JSON 数据');
    return [];
  }
}
