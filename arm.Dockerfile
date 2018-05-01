FROM arm32v7/node

RUN apt update \
    && apt install mplayer espeak -y \
    && apt-get clean \
    && rm -rf /var/cache/apt/archives/ \
    && usermod -aG audio node

USER node

RUN cd \
    && git clone https://github.com/piurafunk/slack-audiobot.git \
    && cd slack-audiobot \
    && npm install

WORKDIR /home/node/slack-audiobot

CMD ["node", "audiobot.js"]