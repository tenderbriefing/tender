const { getSourceById } = require('../../../../config/procurementSources')
const base = require('../_sourceScraperBase')

async function scrape() {
  const source = getSourceById('transnet')
  return base.runGenericSourceScraper(source, ['/', '/Pages/Tenders.aspx', '/tenders'])
}

module.exports = { scrape, sourceId: 'transnet' }
