import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';

/**
 * Checks if the device can open the phone dialer.
 * On modern Android/iOS, this requires manifest/plist declarations to be accurate.
 */
export async function getPhonePermissionStatus(): Promise<boolean> {
  try {
    const url = 'tel:+1234567890';
    return await Linking.canOpenURL(url);
  } catch (error) {
    console.warn('[Permissions] canOpenURL(tel) check failed:', error);
    // On some devices, canOpenURL fails but openURL works. 
    // We return true as a fallback for production unless we're 100% sure it's unsupported.
    return Platform.OS !== 'web'; 
  }
}

/**
 * Legacy wrapper to match existing calls.
 * Calling dialer doesn't actually need system permission request, just device capability.
 */
export async function requestPhonePermission(): Promise<boolean> {
  const supported = await getPhonePermissionStatus();
  if (!supported && Platform.OS !== 'web') {
     Alert.alert(
      'Phone Unavailable',
      'This device does not appear to support phone calls.',
      [{ text: 'OK' }]
    );
  }
  return supported;
}

/**
 * Opens the phone dialer with the provided number.
 * Standardizes the number formatting for better compatibility.
 */
export async function testPhoneCall(phoneNumber?: string): Promise<boolean> {
  if (!phoneNumber || !phoneNumber.trim()) {
    Alert.alert('Invalid Number', 'No phone number provided.');
    return false;
  }

  // Sanitize: keep +, numbers and leading zero. Remove spaces/dashes.
  const sanitized = phoneNumber.replace(/[^\d+]/g, '');
  const url = `tel:${sanitized}`;
  
  try {
    // We try to open directly as canOpenURL is unreliable on many devices
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('[Permissions] Call failed:', error);
    Alert.alert(
      'Call Failed', 
      'Could not open dialer. This device might not support phone calls.'
    );
    return false;
  }
}

/**
 * Opens the SMS app with the provided number.
 */
export async function testSms(phoneNumber?: string): Promise<boolean> {
  if (!phoneNumber || !phoneNumber.trim()) return false;
  
  const sanitized = phoneNumber.replace(/[^\d+]/g, '');
  const url = `sms:${sanitized}`;
  
  try {
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('[Permissions] SMS failed:', error);
    return false;
  }
}
