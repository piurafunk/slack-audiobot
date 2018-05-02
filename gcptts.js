module.exports = (text) => {
    const axios = require('axios');

    return axios({
        url: 'https://texttospeech.googleapis.com/v1beta1/text:synthesize',
        method: 'post',
        params: {
            key: process.env.GCP_API_KEY
        },
        data: {
            input: {
                text: text
            },
            voice: {
                languageCode: 'en-US',
                name: 'en-US-Wavenet-D'
            },
            audioConfig: {
                audioEncoding: 'MP3'
            }
        }
    })
};