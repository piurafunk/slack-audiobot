require('dotenv').config();
const {spawn} = require('child_process');
const {RTMClient, WebClient} = require('@slack/client');
const {lstatSync, readdirSync, accessSync, constants, writeFileSync} = require('fs');

const SUPPORTED_FORMATS = ['.mp3', '.wav'];

const ttsDriver = process.env.TTS_DRIVER;

const rtm = new RTMClient(process.env.TOKEN);
rtm.start();

const web = new WebClient(process.env.TOKEN);
web.channels.list()
    .then(res => {
        const channels = (res.channels.filter(c => c.is_member) || []).map(c => c.name) || [];

        if (channels.length > 0) {
            console.log('You are in the following public channels: ' + channels.join(', ') + '.');
        } else {
            console.log('You are not in any public channels.');
        }
    });

web.groups.list()
    .then(res => {
        const groups = (res.groups.filter(g => g.is_member && !g.is_archived) || []).map(g => g.name) || [];

        if (groups.length > 0) {
            console.log('You are in the following private channels: ' + groups.join(', ') + '.');
        } else {
            console.log('You are not in any private channels.');
        }
    })
    .catch(err => {
        console.log(err);
    });

const makeMention = (userId) => {
    return '<@' + userId + '>';
};

const isDirect = (userId, messageText) => {
    let userTag = makeMention(userId).slice(0, -1) + '(\\|\\w+)?>';
    return messageText && messageText.search(userTag) > -1;
};

const listDirectory = (dir) => {
    dir = 'sounds/' + (dir || '');

    let files = readdirSync(dir);

    let directories = files.filter(file => lstatSync(dir + '/' + file).isDirectory());

    let soundFiles = [];

    files.forEach(fileInfo => {
        fileInfo = fileInfo.split('.').reverse();

        const fileExtension = '.' + fileInfo[0];
        const fileName = fileInfo.splice(1, 1)[0];

        if (SUPPORTED_FORMATS.indexOf(fileExtension) > -1) {
            soundFiles.push(fileName);
        }
    });

    return {directories: directories, files: soundFiles};
};

const playFile = (file, player) => {
    SUPPORTED_FORMATS.every(extension => {
        try {
            accessSync(file + extension, constants.R_OK);
            const sound = spawn(player, [file + extension]);

            sounds.push(sound);

            sound.on('error', err => {
                console.log('ERROR: ' + err);
            });

            sound.on('close', () => {
                sounds.splice(sounds.findIndex(s => s.pid === sound.pid));
            });

            console.log('playing: ' + file + extension);
            return false;
        } catch (e) {
            return true;
        }
    });
};

const trimMessage = (userId, text) => {
    const userTag = makeMention(userId);
    let trimmedMessage = text.substr(text.indexOf(userTag) + userTag.length).trim().split(' ')[0];

    if (trimmedMessage.slice(-1) === '.') {
        trimmedMessage = trimmedMessage.substr(0, -1);
    }

    return trimmedMessage;
};

const trimBefore = (userId, text) => {
    const userTag = makeMention(userId);
    return text.substr(text.indexOf(userTag) + userTag.length).trim();
};

let sounds = [];

rtm.on('message', event => {
    // Check if we should handle this message]
    if ((event.user === rtm.activeUserId) || !isDirect(rtm.activeUserId, event.text)) {
        return;
    }

    //get current time
    const currentTime = Math.floor(Date.now() / 1000);

    if ((currentTime - event.ts) > 10) {
        //current message is older than 10 seconds, so ignore this - this is to stop the bot from spamming the channel like it did that time.
        return;
    }

    let channel = event.channel;

    // Trim the message
    let trimmedMessage = trimMessage(rtm.activeUserId, event.text);

    // Handle telling bot to start listening
    if (trimmedMessage === 'start') {
        listening = true;
        rtm.sendMessage('I am now listening.', channel);
        return;
    }

    // Handle telling bot to stop listening
    if (trimmedMessage === 'stop') {
        listening = false;
        rtm.sendMessage('I stopped listening.', channel);
        return;
    }

    // Handle telling bot to stop all sounds
    if (trimmedMessage === 'mute') {
        sounds.forEach(s => {
            s.kill()
        });
    }

    //spit out a list of help commands
    if (trimmedMessage === 'help') {
        rtm.sendMessage(`Type _<@${rtm.activeUserId}>_ and then a valid sound name to make me play that sound\n` +
            `For a list of valid sound names, type _<@${rtm.activeUserId}> list_ (I'll listen for this even when stopped)\n` +
            `To stop me listening for play events,  type  _<@${rtm.activeUserId}> stop_\n` +
            `To start me listening for play events,  type  _<@${rtm.activeUserId}> start_ (I'm _on_ by default)\n` +
            `To mute currently playing sounds, type _<@${rtm.activeUserId}> mute_`, channel);
        return;
    }

    if (!listening) {
        return;
    }

    // Spit out a list of valid sounds that bot can play
    if (trimmedMessage.split(' ')[0] === 'list') {
        trimmedMessage = trimBefore(rtm.activeUserId, event.text);
        let contents = listDirectory(trimmedMessage.split(' ')[1] || '');

        let output = 'Directories:\n\t' + contents.directories.join('\n\t') + "\n" + 'Files:\n\t' + contents.files.join('\n\t');

        rtm.sendMessage(output, channel);

        return;
    }

    let player = (process.env.player || 'mplayer');

    //TTS - use winsay if on windows, else use say CLI for mac
    if ((event.text.indexOf("say") > -1) && (listening === true)) {

        let toSpeak = event.text.substring(event.text.indexOf("say") + 4);

        switch (ttsDriver) {
            case 'winsay':
                require('winsay').speak('null', toSpeak);
                return;
            case 'espeak':
                exec('espeak ' + toSpeak);
                return;
            case 'gcptts':
                require('./gcptts')(toSpeak)
                    .then(res => {
                        const data = Buffer.from(res.data.audioContent, 'base64');
                        writeFileSync('sounds/gcptts/output.mp3', data, 'binary');
                        playFile('sounds/gcptts/output', player);
                    });
                return;
        }
    }

    // Default to playing a sound

    let soundToPlay = 'sounds/' + trimmedMessage.split(' ')[0];

    playFile(soundToPlay, player);
});

let listening = true;
console.log("I'm listening now!");
