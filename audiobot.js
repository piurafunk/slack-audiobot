require('dotenv').config();
let exec = require('child_process').exec;
const {RTMClient, WebClient} = require('@slack/client');
let fs = require('fs');
let os = require('os');
let platform = os.platform();

const SUPPORTED_FORMATS = ['.mp3', '.wav'];

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

const makeMention = function (userId) {
    return '<@' + userId + '>';
};

const isDirect = function (userId, messageText) {
    let userTag = makeMention(userId);
    return messageText &&
        messageText.length >= userTag.length &&
        messageText.substr(0, userTag.length) === userTag;
};

rtm.on('message', event => {
    // Check if we should handle this message
    if ((event.subtype && 'bot_message' === event.subtype) ||
        (!event.subtype && event.user === rtm.activeUserId) ||
        !isDirect(rtm.activeUserId, event.text)) {
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
    let trimmedMessage = event.text.substr(makeMention(rtm.activeUserId).length).trim();

    // Handle telling bot to start listening
    if (trimmedMessage === 'start' || trimmedMessage === ': start') {
        listening = true;
        rtm.sendMessage('I am now listening.', channel);
        return;
    }

    // Handle telling bot to stop listening
    if (trimmedMessage === 'stop' || trimmedMessage === ': stop') {
        listening = false;
        rtm.sendMessage('I stopped listening.', channel);
        return;
    }

    // Spit out a list of valid sounds that bot can play
    if ((trimmedMessage === 'list' || trimmedMessage === ': list') && (listening === true)) {
        let files = fs.readdirSync('sounds/');
        let soundFiles = [];

        files.forEach(fileInfo => {
            fileInfo = fileInfo.split('.').reverse();

            const fileExtension = '.' + fileInfo[0];
            const fileName = fileInfo.splice(1, 1)[0];

            if (SUPPORTED_FORMATS.indexOf(fileExtension) > -1) {
                soundFiles.push(fileName);
            }
        });

        rtm.sendMessage('@' + event.user.name + ' Valid sounds are: ' + soundFiles.join(', '), channel);

        return;
    }

    //spit out a list of help commands
    if (trimmedMessage === 'help') {
        rtm.sendMessage('Type _@audiobot_ and then a valid sound name to make me play that sound\n' +
            'For a list of valid sound names, type _@audiobot list_ (I\'ll listen for this even when stopped)\n' +
            'To stop me listening for play events,  type  _@audiobot stop_\n' +
            'To start me listening for play events,  type  _@audiobot start_ (I\'m _on_ by default)\n', channel);
        return;
    }

    if (!listening) {
        return;
    }

    let player = (process.env.player || 'mplayer') + ' ';

    let outputDevice = '';
    //pick output device 1 = headphones, 2 = speakers (default) - windows only
    if (platform === 'win32') {
        player = 'mplayer ';
        let hasTest = event.text.indexOf("test");
        if (hasTest > -1) {
            //test was included, so play through device 1 (headphones)
            outputDevice = '-ao dsound:device=1 ';
        } else {
            //test not included so play through device 2 (speakers)
            outputDevice = '-ao dsound:device=2 ';
        }
    }

    //TTS - use winsay if on windows, else use say CLI for mac
    if ((event.text.indexOf("say") > -1) && (listening === true)) {

        let toSpeak = event.text.substring(event.text.indexOf("say") + 4);

        if (platform === 'win32') {
            require('winsay').speak("null", toSpeak);
        } else if (platform === 'linux') {
            exec('espeak ' + toSpeak);
        } else {
            exec('say ' + toSpeak);
        }

        return;
    }

    // Default to playing a sound

    let soundToPlay = 'sounds/' + event.text.split(' ').splice(1).join(' ');

    SUPPORTED_FORMATS.every(extension => {
        try {
            fs.accessSync(soundToPlay + extension, fs.constants.R_OK);
            exec(player + outputDevice + ' ' + soundToPlay + extension);
            console.log('playing: ' + soundToPlay + extension);
            return false;
        } catch (e) {
            return true;
        }
    });
});

let listening = true;
console.log("I'm listening now!");