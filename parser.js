const js = require('JSONStream')
const fs = require('fs')
const path = require('path')
const htmlCreator = require('html-creator')
const { send } = require('process')

const fullPath = path.resolve(process.argv[2])
const parser = js.parse('conversations.*')
const dir = 'output'
const chats = []
let chatId = 1

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
}

fs.copyFileSync('./resources/chat.css', `./${dir}/chat.css`)
fs.copyFileSync('./resources/chats.css', `./${dir}/chats.css`)
fs.copyFileSync('./resources/chats.js', `./${dir}/chats.js`)

fs.createReadStream(fullPath).pipe(parser).once('close', () => {
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
})

parser.on('data', (data) => {

    const participants = data.conversation.conversation.participant_data
    const fn = chatId + '__' + participants.map(pd => pd.fallback_name?.replace(' ', '-')).join('_')
    chatId++
    const messages = []
    let numberOfMessages = 0
    let sender = ''
    let time = ''
    let texts = []
    let isYou = false
    let chatName = participants.map(p => p.fallback_name).join(', ')

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
        if (e.hasOwnProperty('chat_message') && e.chat_message.message_content.hasOwnProperty('segment')) {
            // TODO: What other segments are there here other than links and text
            const text = escapeHTML(e.chat_message.message_content.segment.filter(s => s.type === 'TEXT').map(s => s.text).join())
            let link = e.chat_message.message_content.segment.filter(s => s.type === 'LINK').map(s => s.text).join()

            if (link) {
                link = `<a href='${link}' target='_blank'>${link}</a>`
            }

            const name = participants.find(p => p.id.chat_id === e.sender_id.chat_id)?.fallback_name || 'Unknown'

            if (name === sender || !sender) {
                // Add this message to the previous one
                if (text) {
                    texts.push(text)
                }

                if (link) {
                    texts.push(link)
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

                texts = [text || link]
            }

            time = new Date(Number.parseInt(e.timestamp) / 1000)
            isYou = data.conversation.conversation.self_conversation_state.self_read_state.participant_id.chat_id === e.sender_id.chat_id
            sender = name
        }
        // Conversation Rename
        else if (e.hasOwnProperty('conversation_rename')) {
            if (e.conversation_rename.new_name) {
                console.log('Conversation renamed to: ' + e.conversation_rename.new_name)
                chatName = e.conversation_rename.new_name
            }
        }
        // Attachments
        else if (e.hasOwnProperty('chat_message') && e.chat_message.hasOwnProperty('message_content')) {
            e.chat_message.message_content.attachment.forEach(a => {
                // TODO: Handle other types of attachments
                if (a.embed_item.type[0] === 'PLUS_PHOTO') {
                    const url = new URL(a.embed_item.plus_photo.url)
                    const parts = url.pathname.split('/')
                    const attachmentName = parts[parts.length - 1]
                    // TODO: Add the images to the chat log
                }
                else {
                    console.log('Other Attachment: ' + a)
                }
            })
        }
        // Calls
        else if (e.hasOwnProperty('hangout_event')){
            if (e.hangout_event.event_type === 'START_HANGOUT') {
                texts.push('<div class="message__hangout">Hangout Started</div>')
            }
            else if (e.hangout_event.event_type === 'END_HANGOUT') {
                const duration = new Date(e.hangout_event.hangout_duration_secs * 1000).toISOString().substr(11, 8)
                texts.push(`<div class="message__hangout">Hangout Ended +${duration}</div>`)
            }
        }
        // User change
        else if (e.hasOwnProperty('membership_change')) {
            const name = participants.find(p => p.id.chat_id === e.membership_change.participant_id.chat_id)?.fallback_name || 'Unknown'

            if (e.membership_change.type === 'JOIN') {
                texts.push(`<div class="message__hangout">${name} Joined</div>`)
            }
            else if (e.membership_change.type === ' LEAVE') {
                texts.push(`<div class="message__hangout">${name} Left</div>`)
            }
        }
        else {
            console.log(e)
        }
    })

    const chat = {
        type: 'div',
        attributes: {
            'data-filename': `${fn}.html`,
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
                        href: 'chat.css'
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
        new htmlCreator(html).renderHTMLToFile(`./${dir}/${fn}.html`)
    }
})
