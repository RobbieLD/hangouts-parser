const js = require('JSONStream')
const fs = require('fs')
const path = require('path')
const https = require('https')
const htmlCreator = require('html-creator')

// *** You might need to configure these ***

// The directory you're like the converted files placed in
const dir = 'output'

// The name of the json file in the export from google (usually called hangouts.json)
const dataFileName = 'hangouts.json'

// The default inline with of images
const imageWidth = '20em'

// Set to true if you'd like the attachments downloaded
const downloadAttachments = true

const parser = js.parse('conversations.*')
const chats = []
const inputPath = path.resolve(`${process.argv[2]}`)
let chatId = 1
let attachmentId = 1
const dataPath = `${inputPath}/${dataFileName}`
const downloadRequests = []
let downloadIndex = 0

const downloadFile = (request, callback) => {
    https.get(request.remotePath, (response) => {
        if (response.statusCode === 200) {
            const file = fs.createWriteStream(request.localPath)
            response.pipe(file).once('close', () => {
                file.close()
                callback()
            })
        }
        else {
            console.error(`Error downloading attachment from ${request.remotePath}: Http Status Code: ${response.statusCode}`)
            callback()
        }
    })
}

const downloadCallback = () => {
    downloadIndex++
    if (downloadIndex < downloadRequests.length) {
        downloadFile(downloadRequests[downloadIndex], downloadCallback)
    }
}

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir)

    if (downloadAttachments) {
        fs.mkdirSync(`${dir}/attachments`)
    }

    fs.mkdirSync(`${dir}/chats`)
}

fs.copyFileSync('./resources/chat.css', `./${dir}/chat.css`)
fs.copyFileSync('./resources/chats.css', `./${dir}/chats.css`)
fs.copyFileSync('./resources/chats.js', `./${dir}/chats.js`)

fs.createReadStream(dataPath).pipe(parser).once('close', () => {
    // Write out the index file
    const html = [
        {
            type: 'head',
            content: [
                {
                    type: 'title',
                    content: 'Hangouts Export'
                },
                {
                    type: 'link',
                    attributes: {
                        rel: 'stylesheet',
                        type: 'text/css',
                        media: 'screen',
                        href: 'chats.css'
                    }
                }
            ]
        },
        {
            type: 'body',
            content: [
                {
                    type: 'div',
                    attributes: {
                        class: 'chats'
                    },
                    content: [
                        {
                            type: 'div',
                            attributes: {
                                class: 'chats__list'
                            },
                            content: chats
                        },
                        {
                            type: 'div',
                            attributes: {
                                class: 'chats__viewport',
                            },
                            content: [
                                {
                                    type: 'iframe',
                                    attributes: {
                                        class: 'viewport'
                                    },
                                    content: []
                                }
                            ]
                        }
                    ]
                },
                {
                    type: 'script',
                    attributes: {
                        src: 'chats.js'
                    },
                    content: []
                }
            ]
        }
    ]

    new htmlCreator(html).renderHTMLToFile(`./${dir}/index.html`)

    console.log(`Downloading ${downloadRequests.length} files`)
    // Process the file queue
    if (downloadRequests && downloadRequests.length) {
        downloadFile(downloadRequests[downloadIndex], downloadCallback)
    }
})

parser.on('data', (data) => {

    const participants = data.conversation.conversation.participant_data
    const fn = chatId + '__' + participants.map(pd => pd.fallback_name?.replace(' ', '-')).join('_')
    chatId++
    const messages = []
    let numberOfMessages = 0
    let texts = []
    let chatName = participants.map(p => p.fallback_name).join(', ')
    let sender = ''
    let time = ''
    let isYou = false

    const escapeHTML = str => str.replace(/[&<>'"]/g,
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag]));

    // Process the chat events for this conversation
    data.events.forEach(e => {

        const name = participants.find(p => p.id.chat_id === e.sender_id.chat_id)?.fallback_name || 'Unknown'
        let text = ''

        // Text (or link) message
        if (e.hasOwnProperty('chat_message') && e.chat_message.message_content.hasOwnProperty('segment')) {
            text = escapeHTML(e.chat_message.message_content.segment.filter(s => s.type === 'TEXT').map(s => s.text).join())
            const links = e.chat_message.message_content.segment.filter(s => s.type === 'LINK').map(s => s.text)

            if (links && links.length) {
                links.forEach(l => {
                    text += `<a href='${l}' target='_blank'>${l}</a>`
                })
            }
        }
        // Conversation Rename
        else if (e.hasOwnProperty('conversation_rename')) {
            if (e.conversation_rename.new_name) {
                console.log('Conversation renamed to: ' + e.conversation_rename.new_name)
                chatName = e.conversation_rename.new_name
                text += `<div class="message__hangout">Conversation Renamed: ${chatName}</div>`
            }
        }
        // Attachments
        else if (e.hasOwnProperty('chat_message') && e.chat_message.hasOwnProperty('message_content')) {
            e.chat_message.message_content.attachment.forEach(a => {
                if (a.embed_item.type[0] === 'PLUS_PHOTO') {
                    const photoUrl = new URL(a.embed_item.plus_photo.url)
                    let imagePath = ''
                    let videoPath = ''
                    
                    const addExtension = (url, id, ext) => {
                        const fileExtensionPattern = /^.*\..*$/
                        const parts = url.pathname.split('/')
                        const attachmentName = parts[parts.length - 1]
                        let fileName = `${id}__${attachmentName}`

                        if (!fileName.match(fileExtensionPattern)) {
                            fileName += ext
                        }

                        return fileName
                    }

                    if (downloadAttachments) {
                        
                        imagePath = `${dir}/attachments/${addExtension(photoUrl, attachmentId, '.jpg')}`

                        if (!fs.existsSync(imagePath)) {
                            downloadRequests.push({
                                localPath: imagePath,
                                remotePath: photoUrl
                            })
                        }

                        // This is a video we can need to download it and update the link path
                        if (a.embed_item.plus_photo.download_url) {
                            const videoUrl = new URL(a.embed_item.plus_photo.download_url)

                            videoPath = `${dir}/attachments/${addExtension(videoUrl, attachmentId, '.mp4')}`

                            if (!fs.existsSync(videoPath)) {
                                downloadRequests.push({
                                    localPath: videoPath,
                                    remotePath: videoUrl
                                })
                            }
                            
                        }

                        attachmentId++
                    }
                    
                    text += `<a target="_blank" href="../../${videoPath || imagePath}"><img style="width:${imageWidth}" src="../../${imagePath}"/></a>`
                }
                else {
                    console.log('Other Attachment found')
                    console.log(a)
                }
            })
        }
        // Calls
        else if (e.hasOwnProperty('hangout_event')){
            if (e.hangout_event.event_type === 'START_HANGOUT') {
                text += '<div class="message__hangout">Hangout Started</div>'
            }
            else if (e.hangout_event.event_type === 'END_HANGOUT') {
                const duration = new Date(e.hangout_event.hangout_duration_secs * 1000).toISOString().substr(11, 8)
                text += `<div class="message__hangout">Hangout Ended +${duration}</div>`
            }
        }
        // User change
        else if (e.hasOwnProperty('membership_change')) {
            const name = participants.find(p => p.id.chat_id === e.membership_change.participant_id.chat_id)?.fallback_name || 'Unknown'

            if (e.membership_change.type === 'JOIN') {
                text += `<div class="message__hangout">${name} Joined</div>`
            }
            else if (e.membership_change.type === ' LEAVE') {
                text += `<div class="message__hangout">${name} Left</div>`
            }
        }
        else {
            // This is just here to log out any additional message types not already hadnled for adding in the future (if there are any)
            console.log(e)
        }

        if (name === sender || !sender) {
            // Add this message to the previous one
            if (text) {
                texts.push(text)
            }
        }
        else {
            numberOfMessages++

            // insert this message into the collection and start a new one
            const content = [
                {
                    type: 'div',
                    attributes: {
                        class: 'message__name'
                    },
                    content: sender
                }
            ]

            texts.forEach(t => {
                content.push(
                    {
                        type: 'div',
                        content: t
                    }
                )
            })

            content.push(
                {
                    type: 'div',
                    attributes: {
                        class: 'message__time'
                    },
                    content: time.toISOString()
                }
            )

            messages.push(
                {
                    type: 'div',
                    attributes: {
                        class: `message ${(isYou ? 'message--you' : '')}`
                    },
                    content: content
                }
            )

            texts = [text]
        }

        time = new Date(Number.parseInt(e.timestamp) / 1000)
        isYou = data.conversation.conversation.self_conversation_state.self_read_state.participant_id.chat_id === e.sender_id.chat_id
        sender = name
    })

    const chat = {
        type: 'div',
        attributes: {
            'data-filename': `chats/${fn}.html`,
            class: 'chat'
        },
        content: [
            {
                type: 'div',
                attributes: {
                    class: 'chat__participants'
                },
                content: chatName
            },
            {
                type: 'div',
                attributes: {
                    class: 'chat__messages'
                },
                content: `${numberOfMessages} messages`
            }
        ]
    }

    if (numberOfMessages) {
        chats.push(chat)
    }

    const html = [
        {
            type: 'head',
            content: [
                {
                    type: 'title',
                    content: fn
                },
                {
                    type: 'link',
                    attributes: {
                        rel: 'stylesheet',
                        type: 'text/css',
                        media: 'screen',
                        href: '../chat.css'
                    }
                }
            ]
        },
        {
            type: 'body',
            content: [
                {
                    type: 'div',
                    attributes: {
                        class: 'messages'
                    },
                    content: messages
                }
            ]
        }
    ]

    if (numberOfMessages) {
        new htmlCreator(html).renderHTMLToFile(`./${dir}/chats/${fn}.html`)
    }
})
