FROM node:alpine

RUN apk add git mplayer --no-cache \
    && adduser node audio

USER node

RUN cd \
    && git clone https://github.com/piurafunk/slack-audiobot.git \
    && npm install

WORKDIR /home/node/slack-audiobot

CMD ["node", "audiobot.js"]