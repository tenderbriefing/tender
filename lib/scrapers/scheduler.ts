import { scrapingService } from './scrapingService'

export class ScrapingScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false
  private intervalMinutes = 60 // Run every hour

  start(): void {
    if (this.isRunning) {
      console.log('Scraping scheduler is already running')
      return
    }

    this.isRunning = true
    console.log(`🕐 Starting scraping scheduler (every ${this.intervalMinutes} minutes)`)

    // Run immediately
    this.runScraping()

    // Schedule recurring runs
    this.intervalId = setInterval(() => {
      this.runScraping()
    }, this.intervalMinutes * 60 * 1000)
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('⏹️ Scraping scheduler stopped')
  }

  private async runScraping(): Promise<void> {
    try {
      console.log('🔄 Running scheduled scraping...')
      await scrapingService.startScraping()
      console.log('✅ Scheduled scraping completed')
    } catch (error) {
      console.error('❌ Scheduled scraping failed:', error)
    }
  }

  setInterval(minutes: number): void {
    this.intervalMinutes = minutes
    
    if (this.isRunning) {
      // Restart with new interval
      this.stop()
      this.start()
    }
  }

  getStatus(): { isRunning: boolean; intervalMinutes: number } {
    return {
      isRunning: this.isRunning,
      intervalMinutes: this.intervalMinutes
    }
  }
}

// Export singleton instance
export const scrapingScheduler = new ScrapingScheduler()

// Auto-start scheduler in production
if (typeof window === 'undefined' && process.env.NODE_ENV === 'production') {
  scrapingScheduler.start()
}
