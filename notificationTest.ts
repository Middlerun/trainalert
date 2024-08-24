require('dotenv-safe').config()

import { sendNotification } from './notification'

sendNotification('Test', 'This is a test notification')
