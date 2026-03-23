import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import * as Linking from 'expo-linking';

export const PHONE_PERMISSION_KEY = 'phonePermission';

export async function getPhonePermissionStatus(): Promise<boolean> {
  try {
    if (Platform.OS !== 'android') {
      return true; // iOS manages tel: automatically
    }
    
    // Check stored state first
    const stored = await AsyncStorage.getItem(PHONE_PERMISSION_KEY);
    if (stored !== null) {
      return JSON.parse(stored);
    }
    
    // Check actual permission
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE
    );
    await AsyncStorage.setItem(PHONE_PERMISSION_KEY, JSON.stringify(hasPermission));
    return hasPermission;
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

    const status = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
      {
        title: 'Phone Permission Required',
        message: 'This app needs access to your phone to make direct calls to guards.',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );

    const granted = status === PermissionsAndroid.RESULTS.GRANTED;
    await AsyncStorage.setItem(PHONE_PERMISSION_KEY, JSON.stringify(granted));
    
    if (!granted) {
      Alert.alert(
        'Permission Denied',
        'Phone calls are disabled. Enable in device Settings > Apps > OmniWatch > Permissions.',
        [{ text: 'OK' }]
      );
    }
    
    return granted;
  } catch (error) {
    console.error('Error requesting phone permission:', error);
    Alert.alert('Error', 'Failed to request phone permission. Please check manually.');
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

