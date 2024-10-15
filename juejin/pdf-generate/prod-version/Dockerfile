# 使用官方的 Node.js 镜像作为基础镜像
FROM node:20.15.0-slim

# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome for Testing that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# 创建工作目录
RUN mkdir -p /home/app
RUN mkdir -p /home/etahadmin
# 挂在路径
VOLUME /home/etahadmin
# 设置工作目录
WORKDIR /home/app

# 将 package.json 和 package-lock.json 复制到工作目录
COPY package*.json ./

# 安装依赖
RUN npm install --registry=https://registry.npmmirror.com/

# 将所有文件复制到工作目录
COPY . /home/app


# 暴露端口
EXPOSE 7001

# 启动应用
CMD ["npm", "run", "start"]

# 1.拉取项目
# git clone http://xxxxx.git
# 2.创建镜像
# docker build -t node-image .
# 3.创建容器
# docker run --name node-app   -v E:\docker-map\my-puppeteer:/home/etahadmin -p 7001:7001  -d  node-image

