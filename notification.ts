import axios from 'axios'
import { log } from './log'

let twilioClient: any

export function sendViaSMS(title: string, body: string) {
  if (!twilioClient) {
    twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  }
  twilioClient.messages
    .create({
      body,
      from: process.env.SMS_SENDER_NUMBER,
      to: process.env.SMS_RECIPIENT_NUMBER,
    })
    .then(message => log('SID:', message.sid))
    .catch(error => log('Could not send SMS:', error))
}

export function sendViaNotifyDroid(title: string, body: string) {
  const queryParams = new URLSearchParams({
    k: process.env.NOTIFYDROID_API_KEY!,
    t: title,
    c: body,
  })
  const url = `http://xdroid.net/api/message?${queryParams.toString()}`
  axios.post(url)
    .then(response => log('Push notification API response:', response.data))
    .catch(error => log('Could not send push notification:', error, error.response?.data))
}

const notificationChannels = [
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
  {
    name: 'NotifyDroid',
    enabled: !!process.env.NOTIFYDROID_API_KEY,
    send: sendViaNotifyDroid,
  },
] satisfies Array<{ name: string; enabled: boolean; send: (title: string, body: string) => void }>

const enabledChannels = notificationChannels.filter(channel => channel.enabled)

export function sendNotification(title: string, body: string) {
  log('Sending notification', { channels: enabledChannels.map(c => c.name), title, body })
  enabledChannels.forEach(channel => channel.send(title, body))
}
