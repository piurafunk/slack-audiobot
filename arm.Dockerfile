FROM arm32v7/node

RUN apt update \
    && apt install mplayer espeak -y \
    && apt-get clean \
    && rm -rf /var/cache/apt/archives/ \
    && usermod -aG audio node

USER node

ADD --chown=node:node package.json package-lock.json audiobot.js sounds /home/node/slack-audiobot/

RUN cd ~/slack-audiobot\
    && npm install

WORKDIR /home/node/slack-audiobot

CMD ["node", "audiobot.js"]