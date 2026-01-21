import * as Keychain from 'react-native-keychain';

const CREDENTIALS_KEY = 'posthive_credentials';

export interface StoredCredentials {
  email: string;
  password: string;
}

/**
 * Securely store user credentials in the device keychain
 */
export async function saveCredentials(
  email: string,
  password: string,
): Promise<boolean> {
  try {
    const credentials: StoredCredentials = {email, password};
    const jsonCredentials = JSON.stringify(credentials);
    
    await Keychain.setGenericPassword(
      email,
      jsonCredentials,
      {
        service: CREDENTIALS_KEY,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      }
    );
    
    return true;
  } catch (error) {
    console.error('Error saving credentials:', error);
    return false;
  }
}

/**
 * Retrieve stored credentials from the device keychain
 */
export async function getCredentials(): Promise<StoredCredentials | null> {
  try {
    const credentials = await Keychain.getGenericPassword({
      service: CREDENTIALS_KEY,
    });
    
    if (credentials && credentials.password) {
      const parsed = JSON.parse(credentials.password) as StoredCredentials;
      return parsed;
    }
    
    return null;
  } catch (error) {
    console.error('Error retrieving credentials:', error);
    return null;
  }
}

/**
 * Check if credentials are stored
 */
export async function hasStoredCredentials(): Promise<boolean> {
  try {
    const credentials = await getCredentials();
    return credentials !== null;
  } catch {
    return false;
  }
}

/**
 * Remove stored credentials from the device keychain
 */
export async function clearCredentials(): Promise<boolean> {
  try {
    await Keychain.resetGenericPassword({service: CREDENTIALS_KEY});
    return true;
  } catch (error) {
    console.error('Error clearing credentials:', error);
    return false;
  }
}

