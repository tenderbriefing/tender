const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('prasa')
  return base.runGenericSourceScraper(source, ['/', '/tenders', '/procurement'])
}

module.exports = { scrape, sourceId: 'prasa' }
