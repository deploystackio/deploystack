import type { FastifyBaseLogger } from 'fastify';
import { getVersionString } from '../config/version';

// Function to display fancy startup banner
export const displayStartupBanner = (port: number, logger: FastifyBaseLogger): void => {
  const version = getVersionString();

  const message = `
  \x1b[38;5;51m╔═══════════════════════════════════════════════════════════════════════════════════════════════
  ║                                                                                               
  ║  \x1b[38;5;93m██████╗ ███████╗██████╗ ██╗      ██████╗ ██╗   ██╗███████╗████████╗ █████╗  ██████╗██╗  ██╗\x1b[38;5;51m  
  ║  \x1b[38;5;93m██╔══██╗██╔════╝██╔══██╗██║     ██╔═══██╗╚██╗ ██╔╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██║ ██╔╝\x1b[38;5;51m  
  ║  \x1b[38;5;93m██║  ██║█████╗  ██████╔╝██║     ██║   ██║ ╚████╔╝ ███████╗   ██║   ███████║██║     █████╔╝ \x1b[38;5;51m  
  ║  \x1b[38;5;93m██║  ██║██╔══╝  ██╔═══╝ ██║     ██║   ██║  ╚██╔╝  ╚════██║   ██║   ██╔══██║██║     ██╔═██╗ \x1b[38;5;51m  
  ║  \x1b[38;5;93m██████╔╝███████╗██║     ███████╗╚██████╔╝   ██║   ███████║   ██║   ██║  ██║╚██████╗██║  ██╗\x1b[38;5;51m  
  ║  \x1b[38;5;93m╚═════╝ ╚══════╝╚═╝     ╚══════╝ ╚═════╝    ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝\x1b[38;5;51m  
  ║                                                                                               
  ║         \x1b[38;5;82mDeployStack CI/CD Backend \x1b[38;5;196mv${version}\x1b[38;5;51m                                                      
  ║         \x1b[38;5;82mRunning on port \x1b[38;5;196m${port}\x1b[38;5;51m                                                                  
  ║         \x1b[38;5;82mEnvironment: \x1b[38;5;196m${process.env.NODE_ENV || 'development'}\x1b[38;5;51m                                                              
  ║                                                                                               
  ╚═══════════════════════════════════════════════════════════════════════════════════════════════\x1b[0m
  `
  logger.info({
    port,
    version,
    environment: process.env.NODE_ENV || 'development',
    operation: 'startup_banner'
  }, message);
}
