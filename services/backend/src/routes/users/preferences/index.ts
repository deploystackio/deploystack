import { type FastifyInstance } from 'fastify';

// Core preference endpoints
import getPreferences from './get';
import updatePreferences from './update';
import getSpecificPreference from './getSpecific';
import setSpecificPreference from './setSpecific';
// Note: deleteSpecificPreference removed - preferences cannot be deleted

// Specialized walkthrough endpoints
import completeWalkthrough from './walkthrough/complete';
import cancelWalkthrough from './walkthrough/cancel';
import getWalkthroughStatus from './walkthrough/status';

// Specialized notification endpoints
import acknowledgeNotification from './notifications/acknowledge';

export default async function preferencesRoutes(server: FastifyInstance) {
  // Core preference endpoints
  await server.register(getPreferences);
  await server.register(updatePreferences);
  await server.register(getSpecificPreference);
  await server.register(setSpecificPreference);
  // Note: DELETE route removed - preferences are permanent and cannot be deleted
  
  // Specialized endpoints
  await server.register(completeWalkthrough);
  await server.register(cancelWalkthrough);
  await server.register(getWalkthroughStatus);
  await server.register(acknowledgeNotification);
}
