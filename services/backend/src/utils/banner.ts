// Function to display fancy startup banner
export const displayStartupBanner = (port: number): void => {
  const version = process.env.DEPLOYSTACK_BACKEND_VERSION || process.env.npm_package_version || '0.1.0';

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
  console.log(message)
}
