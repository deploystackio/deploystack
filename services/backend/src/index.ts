import { createServer } from './server'
import { displayStartupBanner } from './utils/banner'

const start = async () => {
  try {
    const server = await createServer()
    
    // Use the PORT from .env or default to 3000
    const port = parseInt(process.env.PORT || '3000', 10)
    await server.listen({ port, host: '0.0.0.0' })
    
    // Display the fancy startup banner
    displayStartupBanner(port, server.log)
    
    // Also log using the standard logger (useful for log files)
    server.log.info(`DeployStack server started on port ${port}`)
  } catch (err) {
    // Server creation failed, so we can't use server.log
    // Use process.stderr for critical startup errors
    process.stderr.write(`Error starting server: ${err instanceof Error ? err.message : String(err)}\n`);
    if (err instanceof Error && err.stack) {
      process.stderr.write(`Stack trace: ${err.stack}\n`);
    }
    process.exit(1)
  }
}

start()
