import axios from 'axios'
import { log } from './log'
import { checkNotificationSent, recordNotification } from './notificationRecord'

let twilioClient: any

export function sendViaSMS(title: string, body: string) {
  if (!twilioClient) {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  log('Sending SMS')
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
  log('Sending notification via NotifyDroid')
  const queryParams = new URLSearchParams({
    k: process.env.NOTIFYDROID_API_KEY!,
    t: title,
    c: body,
  })
  const url = `http://xdroid.net/api/message?${queryParams.toString()}`
  return axios.post(url)
    .then(response => {
      log('Push notification API response:', response.data)
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
