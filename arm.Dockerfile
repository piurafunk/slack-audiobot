FROM arm32v7/node

RUN apt update \
    && apt install mplayer -y \
    && apt clean \
    && rm -rf /var/cache/apt/archives/

USER node

RUN cd \
    && git clone https://github.com/piurafunk/slack-audiobot.git \
    && npm install

WORKDIR /home/node/slack-audiobot

CMD ["node", "audiobot.js"]