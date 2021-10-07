const js = require('JSONStream')
const fs = require('fs')
const path = require('path')
const htmlCreator = require('html-creator')

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
    const fn = participants.map(pd => pd.fallback_name?.replace(' ', '-')).join('_') + '__' + chatId
    chatId++
    const messages = []
    let numberOfMessages = 0
    let sender = ''
    let time = ''
    let texts = []
    let isYou = false

    // Process the chat events for this conversation
    data.events.forEach(e => {
        // TODO: handle non text message
        if (e.hasOwnProperty('chat_message') && e.chat_message.message_content.hasOwnProperty('segment')) {
            const text = e.chat_message.message_content.segment.filter(s => s.type === 'TEXT').map(s => s.text).join()
            const name = participants.find(p => p.id.chat_id === e.sender_id.chat_id)?.fallback_name || 'Unknown'
            
            if (name === sender || !sender) {
                // Add this message to the previous one
                texts.push(text)    
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
        }
    });

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
                content: participants.map(p => p.fallback_name).join(', ')
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

    chats.push(chat)

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

    console.log(`Processed file: ${fn}`)
    new htmlCreator(html).renderHTMLToFile(`./${dir}/${fn}.html`)
})
