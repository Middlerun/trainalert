require('dotenv-safe').config()
import * as fs from 'fs'
import * as path from 'path'
import * as unzipper from 'unzipper'

import { readFilteredTrainsCSV, getTripUpdates, downloadDataFileZip, deleteOldDataZips } from './data'
import { sendSMS } from './sms'

enum ScheduleRelationship {
  SCHEDULED = 0,
  SKIPPED = 1,
  NO_DATA = 2,
  UNSCHEDULED = 3
}

const MIN_DELAY_TO_NOTIFY = 30 // seconds

const routePrefix = 'APS_1'

const trainTime = '07:56'

async function run() {
  // Download the GTFS files
  const dataFileZipFilename = await downloadDataFileZip()

  if (dataFileZipFilename) {
    await fs.createReadStream(dataFileZipFilename)
      .pipe(unzipper.Extract({ path: path.join(__dirname, 'sydneytrains_GTFS') }))
      .promise()
    await deleteOldDataZips(dataFileZipFilename)
  }

  // Get stops
  const stationStops = await readFilteredTrainsCSV('stops.txt', (record) => record.stop_name.includes(process.env.STATION_NAME!))
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
    console.log('No relevant stop times found')
    sendSMS('Could not check for train delays - no relevant stop times found in timetable data')
    return
  }

  const relevantTripIds = new Set(relevantStopTimes.map((stopTime) => stopTime.trip_id))

  const updates = await getTripUpdates(relevantTripIds)

  for (const update of updates) {
    console.log(update)
    console.log(update.stopTimeUpdate[0])

    const scheduledStopTime = relevantStopTimes.find((stopTime) => stopTime.trip_id === update.trip.tripId)
    console.log(scheduledStopTime)
    if (!scheduledStopTime) {
      continue
    }
    const scheduledDepartureTime = scheduledStopTime.departure_time.slice(0, 5)

    const trip = tripForId.get(update.trip.tripId)
    if (!trip) {
      continue
    }
    console.log(trip)

    const stopUpdate = update.stopTimeUpdate.find((stopTimeUpdate) => stopTimeUpdate.stopId === scheduledStopTime.stop_id)

    if (!stopUpdate) {
      continue
    }

    console.log(stopUpdate)

    // Send alert if train is cancelled or delayed
    let message = `No date for ${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)}`
    if (stopUpdate.scheduleRelationship === ScheduleRelationship.SKIPPED) {
      message = `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} has been cancelled`
    } else if (stopUpdate.scheduleRelationship === ScheduleRelationship.SCHEDULED) {
      message = `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is on time`
      if (stopUpdate.departure && stopUpdate.departure.delay > MIN_DELAY_TO_NOTIFY) {
        message = `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is delayed by ${formatSeconds(stopUpdate.departure.delay)}`
      } else if (stopUpdate.departure && stopUpdate.departure.delay < -MIN_DELAY_TO_NOTIFY) {
        message = `${scheduledDepartureTime} train at ${stopNameForId.get(scheduledStopTime.stop_id)} is early by ${formatSeconds(-stopUpdate.departure.delay)}`
      }
    }
    console.log(message)
    sendSMS(message)
  }
}

run()

function formatSeconds(seconds: number) {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`
  }
  const minutes = Math.round(seconds / 60)
  return `${minutes} minute ${minutes !== 1 ? 's' : ''}`
}