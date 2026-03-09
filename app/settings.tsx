import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';

export default function SettingsScreen() {
  const router = useRouter();
  // Notification Settings
  const [pushNotifications, setPushNotifications] = useState(true);
  const [logAlerts, setLogAlerts] = useState(true);
  const [patrolReminders, setPatrolReminders] = useState(true);

  // Location Settings
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [locationPermission, setLocationPermission] = useState(false);

  // Camera & Media Settings
  const [cameraPermission, setCameraPermission] = useState(false);
  const [mediaPermission, setMediaPermission] = useState(false);
  const [phonePermission, setPhonePermission] = useState(Platform.OS === 'ios');

  // Load settings on mount
  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  // Check current permissions
  const checkPermissions = async () => {
    try {
      const { status: locationStatus } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(locationStatus === 'granted');

      const { status: cameraStatus } = await ImagePicker.getCameraPermissionsAsync();
      setCameraPermission(cameraStatus === 'granted');

      const { status: mediaStatus } = await ImagePicker.getMediaLibraryPermissionsAsync();
      setMediaPermission(mediaStatus === 'granted');

      if (Platform.OS === 'android') {
        const hasPhonePermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.CALL_PHONE
        );
        setPhonePermission(hasPhonePermission);
      } else {
        setPhonePermission(true);
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  // Load saved settings
  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('appSettings');
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setPushNotifications(settings.pushNotifications ?? true);
        setLogAlerts(settings.logAlerts ?? true);
        setPatrolReminders(settings.patrolReminders ?? true);
        setLocationEnabled(settings.locationEnabled ?? true);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  // Toggle handlers
  const togglePushNotifications = (value: boolean) => {
    setPushNotifications(value);
    if (value) {
      requestNotificationPermissions();
    }
  };

  const toggleLocation = async (value: boolean) => {
    if (value && !locationPermission) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Location permission is needed for patrol tracking.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      setLocationPermission(true);
    }
    setLocationEnabled(value);
  };

  const toggleCamera = async () => {
    if (!cameraPermission) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is needed to take photos for logs.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      setCameraPermission(true);
      Alert.alert('Success', 'Camera permission granted');
    }
  };

  const toggleMedia = async () => {
    if (!mediaPermission) {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Media library permission is needed to attach images to logs.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }
      setMediaPermission(true);
      Alert.alert('Success', 'Media library permission granted');
    }
  };

  const requestPhonePermission = async () => {
    try {
      if (Platform.OS !== 'android') {
        setPhonePermission(true);
        Alert.alert('Info', 'Phone permission is managed by iOS. You can place calls directly.');
        return;
      }

      const status = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CALL_PHONE,
        {
          title: 'Phone Permission',
          message: 'OmniWatch needs phone access so you can call guards directly from the app.',
          buttonNegative: 'Cancel',
          buttonPositive: 'Allow',
        }
      );

      const granted = status === PermissionsAndroid.RESULTS.GRANTED;
      setPhonePermission(granted);

      if (!granted) {
        Alert.alert(
          'Permission Required',
          'Phone permission is needed to place direct calls.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      Alert.alert('Success', 'Phone permission granted');
    } catch (error) {
      console.error('Error requesting phone permission:', error);
      Alert.alert('Error', 'Failed to request phone permission.');
    }
  };

  const callSupport = async () => {
    if (Platform.OS === 'android' && !phonePermission) {
      await requestPhonePermission();
      return;
    }

    const url = 'tel:+15551234567';
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Not Supported', 'This device cannot open the phone dialer.');
        return;
      }
      await Linking.openURL(url);
    } catch (error) {
      console.error('Error opening dialer:', error);
      Alert.alert('Error', 'Failed to open the phone dialer.');
    }
  };

  // Request notification permissions
  const requestNotificationPermissions = () => {
    Alert.alert(
      'Notifications',
      'Push notifications are enabled. You can manage them in your device settings.',
      [{ text: 'OK' }]
    );
  };

  // Save settings when they change
  useEffect(() => {
    const settings = {
      pushNotifications,
      logAlerts,
      patrolReminders,
      locationEnabled,
    };
    AsyncStorage.setItem('appSettings', JSON.stringify(settings)).catch((error) => {
      console.error('Error saving settings:', error);
    });
  }, [pushNotifications, logAlerts, patrolReminders, locationEnabled]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton} 
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerText}>
            <Text style={styles.title}>Settings</Text>
            <Text style={styles.subtitle}>Manage your app preferences</Text>
          </View>
        </View>

        {/* Notifications Section */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#2563eb' + '20' }]}>
                <Ionicons name="notifications" size={20} color="#2563eb" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive push notifications</Text>
              </View>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={togglePushNotifications}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor={pushNotifications ? '#fff' : '#94a3b8'}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#f59e0b' + '20' }]}>
                <Ionicons name="document-text" size={20} color="#f59e0b" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Log Alerts</Text>
                <Text style={styles.settingDescription}>Get notified about new logs</Text>
              </View>
            </View>
            <Switch
              value={logAlerts}
              onValueChange={setLogAlerts}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor={logAlerts ? '#fff' : '#94a3b8'}
              disabled={!pushNotifications}
            />
          </View>

          <View style={styles.divider} />

          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#22c55e' + '20' }]}>
                <Ionicons name="timer" size={20} color="#22c55e" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Patrol Reminders</Text>
                <Text style={styles.settingDescription}>Remind to start patrol</Text>
              </View>
            </View>
            <Switch
              value={patrolReminders}
              onValueChange={setPatrolReminders}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor={patrolReminders ? '#fff' : '#94a3b8'}
              disabled={!pushNotifications}
            />
          </View>
        </View>

        {/* Location Section */}
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#ef4444' + '20' }]}>
                <Ionicons name="location" size={20} color="#ef4444" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Location Services</Text>
                <Text style={styles.settingDescription}>
                  {locationPermission ? 'Enabled' : 'Enable for patrol tracking'}
                </Text>
              </View>
            </View>
            <Switch
              value={locationEnabled}
              onValueChange={toggleLocation}
              trackColor={{ false: '#374151', true: '#2563eb' }}
              thumbColor={locationEnabled ? '#fff' : '#94a3b8'}
            />
          </View>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={() => {
            if (!locationPermission) {
              toggleLocation(true);
            } else {
              Alert.alert(
                'Location Permission',
                'Location permission is already granted. To change, please go to your device settings.',
                [{ text: 'OK' }]
              );
            }
          }}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#8b5cf6' + '20' }]}>
                <Ionicons name="shield-checkmark" size={20} color="#8b5cf6" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Location Permission</Text>
                <Text style={styles.settingDescription}>
                  {locationPermission ? 'Granted' : 'Not granted'}
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[
                styles.statusText,
                { color: locationPermission ? '#22c55e' : '#f59e0b' }
              ]}>
                {locationPermission ? 'Active' : 'Inactive'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Camera & Media Section */}
        <Text style={styles.sectionTitle}>Camera & Media</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow} onPress={toggleCamera}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#06b6d4' + '20' }]}>
                <Ionicons name="camera" size={20} color="#06b6d4" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Camera</Text>
                <Text style={styles.settingDescription}>
                  Take photos for log entries
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[
                styles.statusText,
                { color: cameraPermission ? '#22c55e' : '#f59e0b' }
              ]}>
                {cameraPermission ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={toggleMedia}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#ec4899' + '20' }]}>
                <Ionicons name="images" size={20} color="#ec4899" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Media Library</Text>
                <Text style={styles.settingDescription}>
                  Attach images from gallery
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[
                styles.statusText,
                { color: mediaPermission ? '#22c55e' : '#f59e0b' }
              ]}>
                {mediaPermission ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Phone Section */}
        <Text style={styles.sectionTitle}>Phone</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow} onPress={requestPhonePermission}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#22c55e' + '20' }]}>
                <Ionicons name="call" size={20} color="#22c55e" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Phone Access</Text>
                <Text style={styles.settingDescription}>
                  Allow direct calls from the app
                </Text>
              </View>
            </View>
            <View style={styles.statusBadge}>
              <Text style={[
                styles.statusText,
                { color: phonePermission ? '#22c55e' : '#f59e0b' }
              ]}>
                {phonePermission ? 'Granted' : 'Not Granted'}
              </Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          <TouchableOpacity style={styles.settingRow} onPress={callSupport}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#2563eb' + '20' }]}>
                <Ionicons name="call-outline" size={20} color="#2563eb" />
              </View>
              <View style={styles.settingInfo}>
                <Text style={styles.settingText}>Test Call</Text>
                <Text style={styles.settingDescription}>
                  Open dialer and call support
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* About Section */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.settingRow}>
            <View style={styles.settingLeft}>
              <View style={[styles.iconContainer, { backgroundColor: '#64748b' + '20' }]}>
                <Ionicons name="information-circle" size={20} color="#64748b" />
              </View>
              <Text style={styles.settingText}>App Version</Text>
            </View>
            <Text style={styles.versionText}>1.0.0</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>OmniWatch Guard App</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#111827',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#1e293b',
    marginLeft: 64,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  versionText: {
    color: '#64748b',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    color: '#64748b',
    fontSize: 12,
  },
});
