import { Hono } from 'hono'
import { upgradeWebSocket, websocket } from 'hono/bun'
import { messageQueue } from './services/messageQueue'
import { contentTEXT,processIaResponse } from './utils/index'
import { SpamCleaner, createCleaner, quickClean } from "./filters/spam-cleaner"
import { ConfigurableReplacer } from './controllers/ConfigurableReplacer'
import { removeEmotes } from "./filters/clean-emotes"
import { processCompleteText } from './services/tts'
import { filterManager, checkText, addItemsToBlacklist, removeItemsFromBlacklist, addItemsToWhitelist, removeItemsFromWhitelist }  from './filters/filters'
import { cors } from 'hono/cors'
import { emitter } from './Emitter'
const app = new Hono()
const configurableReplacer = new ConfigurableReplacer();
const myFilter = filterManager.createFilter();
const filterId = myFilter.id;
addItemsToBlacklist(filterId, ['palabra-prohibida-permanente']);
app.use(cors({
  origin: '*',
}))

app.get('/', (c) => {
  return c.text('OVERLAY: https://nglmercer.github.io/multistreamASTRO/widgets/localtts/')
})

// Messages API
app.get('/messages', (c) => {
  const isReadParam = c.req.query('isRead')
  const isReadBool = isReadParam === undefined ? undefined : (isReadParam === 'true' || isReadParam === '1')
  const data = isReadBool === undefined ? messageQueue.getAll() : messageQueue.getAll(isReadBool)
  return c.json(data)
})

app.get('/messages/unread', (c) => {
  return c.json(messageQueue.unread())
})

app.get('/messages/size', (c) => {
  return c.json({ size: messageQueue.size(), unread: messageQueue.unreadSize() })
})

app.post('/messages', async (c) => {
  try {
    const body = await c.req.json()
    const created = messageQueue.add(body as any)
    return c.json(created, 201)
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
})

app.get('/messages/next', (c) => {
  const markParam = c.req.query('markAsRead')
  const markAsRead = markParam === undefined ? true : (markParam === 'true' || markParam === '1')
  const msg = messageQueue.getNextUnread(markAsRead)
  if (!msg) return c.json({ message: 'No unread messages' }, 404)
  return c.json(msg)
})

app.patch('/messages/:id/read', (c) => {
  const id = c.req.param('id')
  const ok = messageQueue.markAsRead(id)
  if (!ok) return c.json({ message: 'Message not found' }, 404)
  return c.json({ ok: true })
})

app.patch('/messages/read-all', (c) => {
  const count = messageQueue.markAllAsRead()
  return c.json({ ok: true, count })
})

app.delete('/messages', (c) => {
  messageQueue.clear()
  return c.json({ ok: true })
})

app.post('/webhook', async (c) => {
  try {
    const body = await c.req.json()
    const NoteventNames = ["server","join","leave","join","unknown"]
    const processedMessage = processIaResponse(body)
    const {user,msg} = contentTEXT(processedMessage)
    const cleanText = removeEmotes(configurableReplacer.replace("user msg",{user,msg,body}))
    if (!user&&!msg|| NoteventNames.includes(body.eventName) || checkText(cleanText)?.isBlocked){
      console.log("ignore",{user,msg},body.eventName)
      return c.json({ data: 'Invalid JSON body',processedMessage }, 200);
    }
    console.log("{user,msg}",{user,msg})
    const cleaned = quickClean(cleanText)
    console.log("processedMessage",{
      cleaned
    },body.eventName)
    emitter.emit('text',cleaned)
    return c.json({ ok: true, cleaned })
  } catch (e) {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }
})
app.get('/api/tts', async (c) => {
  try {
    const text = c.req.query('text')
    if (!text) return c.json({ error: 'Text parameter is required' }, 400)
    const cleaned = quickClean(text)
    const audioData = await processCompleteText(cleaned)
    return c.json({ ok: true, audioData })
  } catch (e) {
    return c.json({ error: 'Failed to process TTS request', details: e }, 500)
  }
})
app.get(
  '/ws',
  upgradeWebSocket((c) => {
    return {
      onMessage(event, ws) {
        console.log(`Message from client: ${event.data}`)
        ws.send('Hello from server!')
      },
      onClose: () => {
        console.log('Connection closed')
      },
      onOpen: (event,ws) => {
        console.log('Connection opened')
        emitter.on('text',(msg) => {
          ws.send(msg)
        })
      }
    }
  })
)

export default {
  fetch: app.fetch,
  port: 9001,
  websocket,
}