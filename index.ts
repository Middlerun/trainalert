require('dotenv-safe').config()
import * as fs from 'fs'
import * as path from 'path'
import * as unzipper from 'unzipper'

import { readFilteredTrainsCSV, getTripUpdates, downloadDataFileZip, deleteOldDataZips, TripScheduleRelationship, StopScheduleRelationship } from './data'
import { sendNotification } from './notification'
import { deleteOldLogs, initialiseFileLogger, log } from './log'

const MINIMUM_EARLY_TO_NOTIFY = 30 // seconds
const MINIMUM_DELAY_TO_NOTIFY = 90 // seconds

// Command line arguments
if (process.argv.length !== 5) {
  console.error('Usage: yarn start <route prefix> <station name> <train time>')
  process.exit(1)
}
const routePrefix = process.argv[2]
const stationName = process.argv[3]
const trainTime = process.argv[4]

async function run() {
  initialiseFileLogger()
  deleteOldLogs()

  log('Arguments:', { routePrefix, stationName, trainTime })

  // Download the GTFS files
  const dataFileZipFilename = await downloadDataFileZip()

  if (dataFileZipFilename) {
    await fs.createReadStream(dataFileZipFilename)
      .pipe(unzipper.Extract({ path: path.join(__dirname, 'sydneytrains_GTFS') }))
      .promise()
    await deleteOldDataZips(dataFileZipFilename)
  }

  // Get stops
  const stationStops = await readFilteredTrainsCSV('stops.txt', (record) => record.stop_name.includes(stationName))
  const stationStopIds = new Set(stationStops.map((stop) => stop.stop_id))
  const stopNameForId = new Map(stationStops.map((stop) => [stop.stop_id, stop.stop_name]))

  // Get trips
  const routeTrips = await readFilteredTrainsCSV('trips.txt', (record) => record.route_id.startsWith(routePrefix))
  const routeTripIds = new Set(routeTrips.map((trip) => trip.trip_id))
  const tripForId = new Map(routeTrips.map((trip) => [trip.trip_id, trip]))

  // Get relevant stop times
  const relevantStopTimes = await readFilteredTrainsCSV('stop_times.txt', (record) => (
    routeTripIds.has(record.trip_id) &&
    stationStopIds.has(record.stop_id) &&
    record.departure_time.startsWith(trainTime)
  ))

  if (relevantStopTimes.length === 0) {
    log('No relevant stop times found')
    sendNotification('Error', 'Could not check for train delays - no relevant stop times found in timetable data')
    return
  }

  const relevantTripIds = new Set(relevantStopTimes.map((stopTime) => stopTime.trip_id))

  const updates = await getTripUpdates(relevantTripIds)

  if (!updates) {
    sendNotification('Error', 'Could not check for train delays - could not fetch real-time data')
    return
  }

  if (updates.length === 0) {
    log('No updates found')
    return
  }

  for (const update of updates) {
    log('Update:', update)

    const scheduledStopTime = relevantStopTimes.find((stopTime) => stopTime.trip_id === update.trip.tripId)
    log('Scheduled stop time:', scheduledStopTime)
    if (!scheduledStopTime) {
      continue
    }
    const scheduledDepartureTime = scheduledStopTime.departure_time.slice(0, 5)

    const notificationKey = `${scheduledStopTime.trip_id}_${scheduledStopTime.stop_id}`

    const trip = tripForId.get(update.trip.tripId!)
    if (!trip) {
      continue
    }
    log('Trip:', trip)

    if (
      update.trip.scheduleRelationship === TripScheduleRelationship.UNSCHEDULED ||
      update.trip.scheduleRelationship === TripScheduleRelationship.CANCELED ||
      update.trip.scheduleRelationship === TripScheduleRelationship.DELETED
    ) {
      sendNotification('Train cancelled', `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} has been cancelled`, notificationKey)
      return
    }

    const stopUpdate = update.stopTimeUpdate?.find((stopTimeUpdate) => stopTimeUpdate.stopId === scheduledStopTime.stop_id)

    if (!stopUpdate) {
      continue
    }

    log('Update for stop:', stopUpdate)

    // Send alert if train is cancelled or delayed
    if (stopUpdate.scheduleRelationship === StopScheduleRelationship.SKIPPED) {
      sendNotification(
        'Train cancelled',
        `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} has been cancelled`,
        notificationKey,
      )
    } else if (stopUpdate.scheduleRelationship === StopScheduleRelationship.SCHEDULED) {
      if (stopUpdate.departure && stopUpdate.departure.delay && stopUpdate.departure.delay > MINIMUM_DELAY_TO_NOTIFY) {
        sendNotification(
          'Train delayed',
          `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is delayed by ${formatSeconds(stopUpdate.departure.delay)}`,
          notificationKey,
        )
      } else if (stopUpdate.departure && stopUpdate.departure.delay && stopUpdate.departure.delay < -MINIMUM_EARLY_TO_NOTIFY) {
        sendNotification(
          'Train early',
          `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is early by ${formatSeconds(-stopUpdate.departure.delay)}`,
          notificationKey,
        )
      } else {
        sendNotification(
          'Train on time',
          `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is on time`,
          notificationKey,
        )
      }
    } else {
      sendNotification(
        'Error',
        `No data for ${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)}`,
        notificationKey,
      )
    }
  }
}

run()

function plural(n: number, singular: string, plural: string = `${singular}s`) {
  return n === 1 ? singular : plural
}

function formatSeconds(seconds: number) {
  if (seconds < 60) {
    return plural(seconds, 'second')
  }
  const minutes = Math.round(seconds / 60)
  return plural(minutes, 'minute')
}