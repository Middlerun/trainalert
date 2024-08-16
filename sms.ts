import { log } from './log'

const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

export function sendSMS(body: string) {
  if (!process.env.ENABLE_SMS) {
    return
  }
  log('Sending SMS with message:', body)
  client.messages
    .create({
      body,
      from: process.env.SMS_SENDER_NUMBER,
      to: process.env.SMS_RECIPIENT_NUMBER,
    })
    .then(message => log('SID:', message.sid))
    .catch(error => log('Could not send SMS:', error))
}