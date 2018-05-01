FROM node:alpine

RUN apk add git mplayer --no-cache \
    && adduser node audio

USER node

ADD --chown=node:node package.json package-lock.json audiobot.js sounds /home/node/slack-audiobot/

RUN cd ~/slack-audiobot \
    && npm install

WORKDIR /home/node/slack-audiobot

CMD ["node", "audiobot.js"]