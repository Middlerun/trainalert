import * as fs from 'fs'
import * as path from 'path'
import { parse } from 'csv-parse'
import axios from 'axios'
import * as protobuf from 'protobufjs'
import { log } from './log'

export async function readFilteredTrainsCSV(filename: string, filter: (record: { [key: string]: string }) => boolean): Promise<Array<{ [key: string]: string }>> {
  const filePath = path.join('sydneytrains_GTFS', filename)

  return new Promise((resolve, reject) => {
    const filteredLines: Array<{ [key: string]: string }> = []

    const parser = fs.createReadStream(filePath)
      .pipe(parse({
        columns: true, // This assumes that the first row of your CSV file contains column names
        skip_empty_lines: true
      }))

    parser.on('data', (row) => {
      if (filter(row)) {
        filteredLines.push(row)
      }
    })

    parser.on('end', () => {
      resolve(filteredLines)
    })

    parser.on('error', (error) => {
      reject(error)
    })
  })
}

export async function getTripUpdates(tripIds: Set<string>): Promise<Array<any> | null> {
  const apiUrl = 'https://api.transport.nsw.gov.au/v2/gtfs/realtime/sydneytrains'
  try {
    // Fetch the data from the web API
    const response = await axios.get<ArrayBuffer>(apiUrl, { responseType: 'arraybuffer', headers: { Authorization: `Bearer apikey ${process.env.API_TOKEN}` } })

    // Load the protobuf schema dynamically
    const root = await protobuf.load("gtfs-realtime.proto")
    const FeedMessage = root.lookupType("transit_realtime.FeedMessage")

    // Decode the protobuf response
    const message = FeedMessage.decode(new Uint8Array(response.data))
    const feed = FeedMessage.toObject(message, { defaults: true })

    const updates: Array<any> = []

    // Search for the trip updates for the specified trip_id and stop_id
    for (const entity of feed.entity) {
      if (entity.tripUpdate && entity.tripUpdate.trip && tripIds.has(entity.tripUpdate.trip.tripId)) {
        updates.push(entity.tripUpdate)
      }
    }

    // If no updates are found, return null
    return updates
  } catch (error) {
    log("Error fetching or processing data:", error)
    return null
  }
}

/**
 * Extracts the filename from the Content-Disposition header.
 * @param contentDisposition - The Content-Disposition header value.
 * @returns The extracted filename.
 */
function getFilenameFromContentDisposition(contentDisposition: string): string | null {
  const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
  const matches = filenameRegex.exec(contentDisposition)
  if (matches != null && matches[1]) {
    return matches[1].replace(/['"]/g, '')
  }
  return null
}

/**
* Downloads a file via an API if it does not already exist in the current directory.
* @param url - The URL to download the file from.
*/
export async function downloadDataFileZip(): Promise<string | undefined> {
  if (!process.env.ENABLE_DATA_REFRESH) {
    return
  }
  const url = 'https://api.transport.nsw.gov.au/v1/gtfs/schedule/sydneytrains'

  try {
    const response = await axios({
      method: 'get',
      url: url,
      responseType: 'stream',
      headers: { Authorization: `Bearer apikey ${process.env.API_TOKEN}` }
    })

    const contentDisposition = response.headers['content-disposition']
    if (contentDisposition && contentDisposition.includes('attachment')) {
      const filename = getFilenameFromContentDisposition(contentDisposition)
      if (!filename) {
        throw new Error('Filename not found in Content-Disposition header')
      }

      const filePath = path.join(__dirname, filename)

      // Check if the file already exists
      if (fs.existsSync(filePath)) {
        log(`File "${filename}" already exists. Skipping download.`)
        return
      }

      // Create a write stream to save the file
      const writer = fs.createWriteStream(filePath)

      // Pipe the response data to the file
      response.data.pipe(writer)

      // Wait for the file to be written
      await new Promise<void>((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
      })

      log(`File "${filename}" downloaded successfully.`)
      return filename
    } else {
      log('The response does not contain a "content-disposition: attachment" header.')
    }
  } catch (error) {
    log(`Error downloading the file: ${error.message}`)
  }
}

const regex = /sydneytrains_GTFS_\d+.zip/
export async function deleteOldDataZips(currentFileName: string): Promise<void> {
  const directoryPath = __dirname

  try {
    const files = await fs.promises.readdir(directoryPath)

    const deletePromises = files
      .filter(file => regex.test(file) && file !== currentFileName)
      .map(async file => {
        const filePath = path.join(directoryPath, file)
        try {
          await fs.promises.unlink(filePath)
          log(`Deleted old zip file "${file}".`)
        } catch (err) {
          log(`Error deleting old zip file "${file}": ${err.message}`)
        }
      })

    await Promise.all(deletePromises)
  } catch (err) {
    log(`Unable to scan directory: ${err.message}`)
  }
}