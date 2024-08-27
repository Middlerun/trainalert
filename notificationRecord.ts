import * as fs from 'fs'
import * as path from 'path'
import { logsDir } from './log'

interface NotificationRecord {
  title: string
  body: string
  timestamp: number
}

interface NotificationRecords {
  date: string
  notifications: {
    [key: string]: NotificationRecord | undefined
  }
}

const recordFilename = 'notification_record.json'
const recordFilePath = path.join(logsDir, recordFilename)

function currentDateISO() {
  return new Date().toISOString().split('T')[0]
}

function generateEmptyRecord(): NotificationRecords {
  return {
    date: currentDateISO(),
    notifications: {}
  }
}

function readNotificationRecord(): NotificationRecords {
  if (!fs.existsSync(recordFilePath)) {
    return generateEmptyRecord()
  }

  const notificationRecord = JSON.parse(fs.readFileSync(recordFilePath, 'utf8'))

  if (notificationRecord.date !== currentDateISO()) {
    return generateEmptyRecord()
  }

  return notificationRecord
}

function writeNotificationRecord(notificationRecord: NotificationRecords) {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir)
  }
  fs.writeFileSync(recordFilePath, JSON.stringify(notificationRecord, null, 2))
}

export function recordNotification(key: string, title: string, body: string) {
  const notificationRecord = readNotificationRecord()
  notificationRecord.notifications[key] = {
    title,
    body,
    timestamp: Date.now()
  }
  writeNotificationRecord(notificationRecord)
}

function getNotificationRecord(key: string) {
  return readNotificationRecord().notifications[key]
}

export function checkNotificationSent(key: string, title: string, body: string): NotificationRecord | undefined {
  const record = getNotificationRecord(key)

  if (!record) {
    return undefined
  }

  if (record.title !== title || record.body !== body) {
    return undefined
  }

  return record
}
