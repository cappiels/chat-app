// Import the version from package.json
import packageJson from '../../package.json';

export const APP_VERSION = packageJson.version;
export const APP_NAME = packageJson.name;

// Function to get formatted version string
export const getVersionString = () => `crew v${APP_VERSION}`;

export default {
  version: APP_VERSION,
  name: APP_NAME,
  getVersionString
};
