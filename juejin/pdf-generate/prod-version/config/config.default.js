/* eslint valid-jsdoc: "off" */

/**
 * @param {Egg.EggAppInfo} appInfo app info
 */
module.exports = appInfo => {
  /**
   * built-in config
   * @type {Egg.EggAppConfig}
   **/
  const config = exports = {};

  // use for cookie sign key, should change to your own and keep security
  config.keys = appInfo.name + '_1726846048202_7791';

  // add your middleware config here
  config.middleware = [];

  config.security = {
    csrf: {
      enable: false,
    },
  };

  /* config.cors = {
    origin: '*', // 允许任何源访问
    allowMethods: 'GET,PUT,POST,DELETE', // 允许的HTTP方法
    credentials: true, // 是否允许发送
  }; */

  // add your user config here
  const userConfig = {
    // myAppName: 'egg',
    tempPathName: 'temp-data',
  };

  return {
    ...config,
    ...userConfig,
  };
};
