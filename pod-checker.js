import express from 'express'
import fs from 'fs'
import crypto from 'crypto'
import fetch from 'node-fetch'

const app = express()
const PORT = 3010

// ✅ API Credentials
const apiKey = '5SZ4PQ82AKNCLYKV82AC'
const apiSecret = '8Bjf9eVdBwDft3qpNZGCWxyRhWB^kEbUBFagVW^T'

const podcastIds = {
  908634: 'Too Many Lawyers',
  4870303: 'Panda Show - Picante',
  418052: 'Erazno y La Chokolata El Podcast',
  1317473: 'El Show De Piolín',
  1061674: 'CarPro Radio Show',
  5988854: 'El DJ Show',
}

// ✅ Function to generate headers
function generateHeaders() {
  const timestamp = Math.floor(Date.now() / 1000)
  const authSignature = crypto
    .createHash('sha1')
    .update(apiKey + apiSecret + timestamp)
    .digest('hex')

  return {
    'X-Auth-Date': timestamp.toString(),
    'X-Auth-Key': apiKey,
    Authorization: authSignature,
    'User-Agent': 'PodcastChecker/1.0',
  }
}

function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9 ]/g, '') // Remove special characters
    .replace(/\s+(.)/g, (_, chr) => chr.toUpperCase()) // Uppercase after space
    .replace(/^./, (chr) => chr.toUpperCase()) // Capitalize first char
}

async function fetchPodcasts() {
  const latestEpisodes = {}

  for (const id in podcastIds) {
    const apiUrl = `https://api.podcastindex.org/api/1.0/episodes/byfeedid?id=${id}&max=1000`
    try {
      const response = await fetch(apiUrl, { headers: generateHeaders() })
      const data = await response.json()

      if (!data || !data.items) {
        console.log(`❌ Invalid API response for ${podcastIds[id]}`)
        continue
      }

      const fileName = `${podcastIds[id]}.json`
      let previousData = []

      if (fs.existsSync(fileName)) {
        previousData = JSON.parse(fs.readFileSync(fileName, 'utf8'))
      }

      const oldTitles = new Set(previousData.map((ep) => ep.id))
      const newFormattedEpisodes = data.items
        .filter((ep) => ep.title && ep.enclosureUrl)
        .map((ep) => ({
          id: toPascalCase(ep.title),
          name: ep.title,
          audioUrl: ep.enclosureUrl,
          imageUrl: ep.feedImage,
          duration: ep.duration ?? null,
        }))

      const newEpisodes = newFormattedEpisodes.filter((ep) => !oldTitles.has(ep.id))

      // ✅ Save formatted full episode list for this podcast
      fs.writeFileSync(fileName, JSON.stringify(newFormattedEpisodes, null, 2))

      console.log(`📢 ${podcastIds[id]} - New Episodes: ${newEpisodes.length}`)

      // ✅ Add to combined latest episodes
      latestEpisodes[podcastIds[id]] = newEpisodes
    } catch (error) {
      console.error(`❌ Error fetching ${podcastIds[id]}:`, error)
    }
  }

  // ✅ Save combined latest episodes
  fs.writeFileSync('latestEpisodes.json', JSON.stringify(latestEpisodes, null, 2))
  console.log('✅ Updated latestEpisodes.json')
}

// ✅ API Endpoint to trigger fetch manually
app.get('/fetch', async (req, res) => {
  await fetchPodcasts()
  res.send('Podcast data updated!')
})

// ✅ Start the server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
})

// ✅ Fetch podcasts on startup & every 24 hours
fetchPodcasts()
setInterval(fetchPodcasts, 24 * 60 * 60 * 1000) // Runs every 24 hours
