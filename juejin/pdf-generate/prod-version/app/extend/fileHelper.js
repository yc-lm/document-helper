/**
 * @name: fileHelper.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const fs = require('fs');
const path = require('path');

/**
 * 创建目录
 * @param {string}  folderPath 目标路径
 * @param {boolean}  recursive 是否递归创建
 * return boolean
 */
function createDirectory(folderPath, recursive = true) {
  try {
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive });
    }
    return true;
  } catch (error) {
    return true;
  }
}

/**
 * 创建目录
 * @param {string}  folderPath 文件夹
 * @param {string}  filePath 文件或者文件夹名称
 * return string
 */
function join(folderPath, filePath) {
  return path.join(folderPath, filePath);
}

/**
 * 创建目录
 * @param {string}  filePath 文件路径
 * return buffer
 */
function readStream(filePath) {
  return fs.createReadStream(filePath);
}

/**
 * 删除目录下所有文件和文件夹
 * @param {string}  filePath 路径
 * @param {boolean}  isSelf 是否删除自己
 * return boolean
 */
function deleteDirectory(filePath, isSelf = true) {
  // 是否存在
  if (!fs.existsSync(filePath)) {
    return false;
  }


  const entries = fs.readdirSync(filePath, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(filePath, entry.name);

    if (entry.isDirectory()) {
      deleteDirectory(entryPath, isSelf);
      fs.rmSync(entryPath, { recursive: true });
    } else {
      fs.unlinkSync(entryPath);
    }
  }

  if (isSelf) {
    fs.rmSync(filePath, { recursive: true });
  }
  return true;
}

module.exports = {
  createDirectory,
  join,
  readStream,
  deleteDirectory,
};
