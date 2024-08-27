import * as fs from 'fs'
import * as path from 'path'

export const logsDir = path.join(__dirname, 'logs')

let writeLog: ((...messages: Array<any>) => void) | null = null

export function initialiseFileLogger(): void {
  const now = new Date()
  const logFilename = `log_${now.toISOString().replace(/:/g, '-')}.txt`
  const logFilePath = path.join(logsDir, logFilename)
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir)
  }
  writeLog = (...messages: Array<any>) => {
    const message = messages.map(m => {
      if (typeof m === 'object') {
        return JSON.stringify(m, null, 2)
      }
      return m
    }).join(' ')
    fs.appendFileSync(logFilePath, `${message}\n`)
  }
}

export function log(...messages: Array<any>): void {
  console.log(...messages)
  writeLog?.(...messages)
}

export function deleteOldLogs() {
  const logFiles = fs.readdirSync(logsDir)
  for (const logFile of logFiles) {
    const logFilePath = path.join(logsDir, logFile)
    const stats = fs.statSync(logFilePath)
    const now = new Date()
    const lastModified = new Date(stats.mtime)
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    if (lastModified < oneWeekAgo) {
      fs.unlinkSync(logFilePath)
    }
  }
}