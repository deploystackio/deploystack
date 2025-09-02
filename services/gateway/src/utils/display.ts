/**
 * Utility functions for displaying information to users
 */

/**
 * Masks the internal backend URL for better user experience
 * Only masks the default DeployStack backend, preserves custom backends as-is
 * 
 * @param backendUrl - The actual backend URL used for API calls
 * @returns The URL to display to the user
 */
export function displayBackendUrl(backendUrl: string): string {
  if (backendUrl === 'https://cloud-api.deploystack.io') {
    return 'https://cloud.deploystack.io';
  }
  return backendUrl;
}
