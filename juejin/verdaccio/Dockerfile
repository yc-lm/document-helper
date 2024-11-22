# The final built image will be based on the standard Verdaccio docker image.
FROM verdaccio/verdaccio:5
# 此处需要换成服务器ip或者域名
ENV VERDACCIO_PUBLIC_URL=http://xx.xx.xx.xx
USER root

RUN npm config set registry https://registry.npmmirror.com/
RUN npm install --global verdaccio-static-token \
  && npm install --global verdaccio-auth-memory
USER $VERDACCIO_USER_UID

RUN chmod 777 -R /verdaccio/storage

# 创建镜像
# docker build -t verdaccio .
# 创建容器
# sudo docker run -itd --name my-verdaccio -p  4873:4873 -v /home/ycc/verdaccio/conf:/verdaccio/conf  --restart=always verdaccio
