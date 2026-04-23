import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';

export const PHONE_PERMISSION_KEY = 'phonePermission';

export async function getPhonePermissionStatus(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') {
      return true;
    }
    
    const supported = await Linking.canOpenURL('tel:');
    return supported;
  } catch (error) {
    console.error('Error getting phone permission status:', error);
    return false;
  }
}

export async function requestPhonePermission(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') {
      return true;
    }

    const supported = await Linking.canOpenURL('tel:');
    
    if (!supported) {
      Alert.alert(
        'Phone Unavailable',
        'This device does not support phone calls. Please use a physical device or simulator with phone capabilities.',
        [{ text: 'OK' }]
      );
      return false;
    }

    await AsyncStorage.setItem(PHONE_PERMISSION_KEY, JSON.stringify(true));
    return true;
  } catch (error) {
    console.error('Error requesting phone permission:', error);
    Alert.alert('Error', 'Failed to check phone capability.');
    return false;
  }
}

export async function testPhoneCall(phoneNumber?: string): Promise<boolean> {
  try {
    const phone = phoneNumber || '+15551234567';
    const url = `tel:${phone}`;
    
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      Alert.alert('Phone Unavailable', 'This device/simulator does not support phone calls.');
      return false;
    }
    
    await Linking.openURL(url);
    return true;
  } catch (error) {
    console.error('Test call failed:', error);
    Alert.alert('Call Failed', `Could not open dialer. Error: ${error}`);
    return false;
  }
}

