/**
 * @name: string.js
 * @author: yangcongcong
 * @date: 2024/9/24
 * @description: 描述
 */
const crypto = require('crypto');
function encrypt(str) {
  return Buffer.from(str)
    .toString('base64');
}

function decrypt(encodedStr) {
  return Buffer.from(encodedStr, 'base64')
    .toString('utf-8');
}

function md5(str) {
  const hash = crypto.createHash('md5');
  return hash.update(str).digest('hex');
}

module.exports = {
  encrypt,
  decrypt,
  md5
};
