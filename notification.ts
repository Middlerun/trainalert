import axios from 'axios'
import { log } from './log'
import { checkNotificationSent, recordNotification } from './notificationRecord'

let twilioClient: any

export function sendViaSMS(title: string, body: string) {
  if (!twilioClient) {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  return twilioClient.messages
    .create({
      body,
      from: process.env.SMS_SENDER_NUMBER,
      to: process.env.SMS_RECIPIENT_NUMBER,
    })
    .then(message => {
      log('SID:', message.sid)
      return true
    })
    .catch(error => {
      log('Failed to send SMS:', error)
      return false
    })
}

export function sendViaNotifyDroid(title: string, body: string) {
  const queryParams = new URLSearchParams({
    k: process.env.NOTIFYDROID_API_KEY!,
    t: title,
    c: body,
  })
  const url = `http://xdroid.net/api/message?${queryParams.toString()}`
  return axios.post(url)
    .then(response => {
      log('NotifyDroid API response:', response.data)
      return true
    })
    .catch(error => {
      log('Failed to send push notification:', error, error.response?.data)
      return false
    })
}

export function sendViaPushover(title: string, body: string) {
  const postBody = {
    token: process.env.PUSHOVER_APP_TOKEN!,
    user: process.env.PUSHOVER_USER_TOKEN!,
    title,
    message: body,
  }
  return axios.post('https://api.pushover.net/1/messages.json', postBody)
    .then(response => {
      log('Pushover API response:', response.data)
      return true
    })
    .catch(error => {
      log('Failed to send push notification:', error, error.response?.data)
      return false
    })
}

const notificationChannels = [
  {
    name: 'NotifyDroid',
    enabled: !!process.env.NOTIFYDROID_API_KEY,
    send: sendViaNotifyDroid,
  },
  {
    name: 'Pushover',
    enabled: !!(
      process.env.PUSHOVER_APP_TOKEN &&
      process.env.PUSHOVER_USER_TOKEN
    ),
    send: sendViaPushover,
  },
  {
    name: 'SMS',
    enabled: !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.SMS_SENDER_NUMBER &&
      process.env.SMS_RECIPIENT_NUMBER
    ),
    send: sendViaSMS,
  },
] satisfies Array<{
  name: string
  enabled: boolean
  send: (title: string, body: string) => Promise<boolean>
}>

const enabledChannels = notificationChannels.filter(channel => channel.enabled)

export async function sendNotification(title: string, body: string, notificationKey?: string) {
  log('Notification:', { title, body })
  const notificationRecord = notificationKey ? checkNotificationSent(notificationKey, title, body) : undefined
  if (notificationRecord) {
    log(`Already sent at ${new Date(notificationRecord.timestamp).toISOString()} - skipping send`)
    return
  }

  let sent = false
  for (const channel of enabledChannels) {
    log(`Sending notification via ${channel.name}`)
    sent = await channel.send(title, body)
    if (sent) { break }
  }

  if (sent && notificationKey) {
    recordNotification(notificationKey, title, body)
  }
  if (!sent) {
    log('All notification channels failed')
  }
}
