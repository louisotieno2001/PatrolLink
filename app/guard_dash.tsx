import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
  Image,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { MapView, Marker, Polyline } from '../components/MapView';
import Constants from 'expo-constants';
import { getUserSession, clearUserSession } from './services/auth.storage';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

// Guard profile data interface
interface GuardProfile {
  name: string;
  id: string;
  operatingHours: {
    start: string;
    end: string;
  };
  assignmentLocation: string;
  assignmentLocationId: string;
  assignedAreas: string[];
}

// Assignment interface from backend
interface Assignment {
  id: string;
  date_created: string;
  date_updated: string;
  location: string;
  assigned_areas: string;
  start_time: string;
  end_time: string;
  user_id: string;
}

interface LocationData {
  id: string;
  name: string;
  assigned_areas: string; // The raw comma-separated string from the backend
}
// User data from session
interface UserData {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  invite_code: string;
  assignments?: Assignment[];
  patrol_status?: PatrolLifecycleStatus;
  ongoing_patrol?: PatrolData | null;
}

type PatrolLifecycleStatus =
  | 'active_on_patrol'
  | 'inactive_patrol_not_started'
  | 'logged_out_on_patrol'
  | 'active'
  | 'completed';

// Patrol data from API
interface PatrolData {
  id: string;
  start_time: string;
  end_time?: string;
  duration?: number;
  user_id: string;
  organization_id?: string;
  map?: string;
  status: PatrolLifecycleStatus;
  date_created: string;
  date_updated: string;
}

// Map update interval in milliseconds (30 seconds)
const MAP_UPDATE_INTERVAL = 30000;
const ACTIVE_PATROL_STATUSES: PatrolLifecycleStatus[] = ['active_on_patrol', 'logged_out_on_patrol', 'active'];
const BACKGROUND_LOCATION_TASK = 'omniwatch-background-patrol-location';
const BACKGROUND_LOCATION_BUFFER_KEY = 'ongoingPatrolBackgroundPoints';
const BACKGROUND_LAST_SENT_AT_KEY = 'ongoingPatrolBackgroundLastSentAt';
const BACKGROUND_LOCATION_FILTER_STATE_KEY = 'ongoingPatrolBackgroundFilterState';
const ONGOING_PATROL_STORAGE_KEY = 'ongoingPatrol';
const TOKEN_STORAGE_KEY = 'user_token';
const MAX_ACCEPTABLE_ACCURACY_METERS = 20;
const STATIONARY_RADIUS_METERS = 8;
const MIN_CONFIRMED_MOVEMENT_METERS = 10;
const REQUIRED_CONSECUTIVE_MOVEMENT_POINTS = 1;
const MAX_STATIONARY_SPEED_MPS = 0.8;
const MAX_REASONABLE_SPEED_MPS = 6;

// Log entry interface
interface LogEntry {
  id: string;
  title: string;
  description: string;
  category: 'activity' | 'unusual' | 'incident' | 'checkpoint' | 'other';
  images: string | null;
  timestamp: string;
  user_id: string;
  patrol_id: string | null;
}

// Log categories
const LOG_CATEGORIES = [
  { value: 'activity', label: 'Activity', icon: 'walk', color: '#2563eb' },
  { value: 'unusual', label: 'Unusual', icon: 'warning', color: '#f59e0b' },
  { value: 'incident', label: 'Incident', icon: 'alert-circle', color: '#ef4444' },
  { value: 'checkpoint', label: 'Checkpoint', icon: 'location', color: '#22c55e' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#64748b' },
];

// Time slots for operating hours
const TIME_SLOTS = [
  '00:00', '01:00', '02:00', '03:00', '04:00', '05:00',
  '06:00', '07:00', '08:00', '09:00', '10:00', '11:00',
  '12:00', '13:00', '14:00', '15:00', '16:00', '17:00',
  '18:00', '19:00', '20:00', '21:00', '22:00', '23:00',
];

type PatrolCoordinate = { latitude: number; longitude: number; timestamp: number };
type LocationSample = PatrolCoordinate & { accuracy: number | null; speed: number | null };
type LocationFilterDecision = { shouldAccept: boolean; nextConsecutiveMovement: number };
type PersistedBackgroundFilterState = {
  lastAccepted: PatrolCoordinate | null;
  consecutiveMovement: number;
};

const toFiniteNumber = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const toPatrolCoordinate = (sample: LocationSample): PatrolCoordinate => ({
  latitude: sample.latitude,
  longitude: sample.longitude,
  timestamp: sample.timestamp,
});

const toLocationSample = (location: Location.LocationObject): LocationSample => ({
  latitude: location.coords.latitude,
  longitude: location.coords.longitude,
  timestamp: location.timestamp || Date.now(),
  accuracy: toFiniteNumber(location.coords.accuracy),
  speed: toFiniteNumber(location.coords.speed),
});

const distanceBetweenCoordinatesMeters = (a: PatrolCoordinate, b: PatrolCoordinate): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadius = 6371000;
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const deltaLat = toRad(b.latitude - a.latitude);
  const deltaLon = toRad(b.longitude - a.longitude);

  const haversine =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadius * arc;
};

const shouldAcceptLocationSample = (
  sample: LocationSample,
  lastAccepted: PatrolCoordinate | null,
  consecutiveMovement: number
): LocationFilterDecision => {
  if (sample.accuracy !== null && sample.accuracy > MAX_ACCEPTABLE_ACCURACY_METERS) {
    return { shouldAccept: false, nextConsecutiveMovement: 0 };
  }

  if (!lastAccepted) {
    return { shouldAccept: true, nextConsecutiveMovement: 0 };
  }

  const displacement = distanceBetweenCoordinatesMeters(lastAccepted, sample);
  if (
    displacement <= STATIONARY_RADIUS_METERS &&
    (sample.speed === null || sample.speed <= MAX_STATIONARY_SPEED_MPS)
  ) {
    return { shouldAccept: false, nextConsecutiveMovement: 0 };
  }

  const elapsedSeconds = (sample.timestamp - lastAccepted.timestamp) / 1000;
  if (elapsedSeconds > 0) {
    const derivedSpeed = displacement / elapsedSeconds;
    if (derivedSpeed > MAX_REASONABLE_SPEED_MPS) {
      return { shouldAccept: false, nextConsecutiveMovement: 0 };
    }
  }

  if (displacement < MIN_CONFIRMED_MOVEMENT_METERS) {
    return { shouldAccept: false, nextConsecutiveMovement: 0 };
  }

  const nextConsecutiveMovement = consecutiveMovement + 1;
  if (nextConsecutiveMovement < REQUIRED_CONSECUTIVE_MOVEMENT_POINTS) {
    return { shouldAccept: false, nextConsecutiveMovement };
  }

  return { shouldAccept: true, nextConsecutiveMovement: 0 };
};

const readBackgroundFilterState = async (): Promise<PersistedBackgroundFilterState> => {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_LOCATION_FILTER_STATE_KEY);
    if (!raw) {
      return { lastAccepted: null, consecutiveMovement: 0 };
    }

    const parsed = JSON.parse(raw);
    return {
      lastAccepted:
        parsed?.lastAccepted &&
        typeof parsed.lastAccepted.latitude === 'number' &&
        typeof parsed.lastAccepted.longitude === 'number' &&
        typeof parsed.lastAccepted.timestamp === 'number'
          ? parsed.lastAccepted
          : null,
      consecutiveMovement:
        typeof parsed?.consecutiveMovement === 'number' && Number.isFinite(parsed.consecutiveMovement)
          ? parsed.consecutiveMovement
          : 0,
    };
  } catch (error) {
    console.error('Error reading background location filter state:', error);
    return { lastAccepted: null, consecutiveMovement: 0 };
  }
};

const writeBackgroundFilterState = async (state: PersistedBackgroundFilterState): Promise<void> => {
  try {
    await AsyncStorage.setItem(BACKGROUND_LOCATION_FILTER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Error writing background location filter state:', error);
  }
};

const readBufferedCoordinates = async (): Promise<PatrolCoordinate[]> => {
  try {
    const raw = await AsyncStorage.getItem(BACKGROUND_LOCATION_BUFFER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Error reading buffered background coordinates:', error);
    return [];
  }
};

const flushBufferedCoordinatesToServer = async (explicitPatrolId?: string): Promise<boolean> => {
  try {
    const coordinates = await readBufferedCoordinates();
    if (coordinates.length === 0) {
      return true;
    }

    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      return false;
    }

    let patrolId = explicitPatrolId || null;
    if (!patrolId) {
      const patrolRaw = await AsyncStorage.getItem(ONGOING_PATROL_STORAGE_KEY);
      if (!patrolRaw) {
        return false;
      }
      const patrol = JSON.parse(patrolRaw);
      patrolId = patrol?.patrolId || null;
    }

    if (!patrolId) {
      return false;
    }

    const response = await fetch(`${API_URL}/patrols/${patrolId}/location`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        location_data: coordinates,
      }),
    });

    if (!response.ok) {
      console.error('Failed to flush buffered background coordinates:', response.status);
      return false;
    }

    await AsyncStorage.removeItem(BACKGROUND_LOCATION_BUFFER_KEY);
    await AsyncStorage.setItem(BACKGROUND_LAST_SENT_AT_KEY, Date.now().toString());
    return true;
  } catch (error) {
    console.error('Error flushing buffered background coordinates:', error);
    return false;
  }
};

if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
  TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
    if (error) {
      console.error('Background location task error:', error);
      return;
    }

    const locations = (data as { locations?: Location.LocationObject[] })?.locations || [];
    if (locations.length === 0) {
      return;
    }

    const existing = await readBufferedCoordinates();
    const filterState = await readBackgroundFilterState();
    const acceptedCoordinates: PatrolCoordinate[] = [...existing];
    let lastAccepted = filterState.lastAccepted;
    let consecutiveMovement = filterState.consecutiveMovement;

    for (const location of locations) {
      const sample = toLocationSample(location);
      const decision = shouldAcceptLocationSample(sample, lastAccepted, consecutiveMovement);
      consecutiveMovement = decision.nextConsecutiveMovement;

      if (!decision.shouldAccept) {
        continue;
      }

      const accepted = toPatrolCoordinate(sample);
      acceptedCoordinates.push(accepted);
      lastAccepted = accepted;
      consecutiveMovement = 0;
    }

    await AsyncStorage.setItem(
      BACKGROUND_LOCATION_BUFFER_KEY,
      JSON.stringify(acceptedCoordinates)
    );
    await writeBackgroundFilterState({ lastAccepted, consecutiveMovement });

    const lastSentRaw = await AsyncStorage.getItem(BACKGROUND_LAST_SENT_AT_KEY);
    const lastSent = Number(lastSentRaw || '0');
    if (Date.now() - lastSent >= MAP_UPDATE_INTERVAL) {
      await flushBufferedCoordinatesToServer();
    }
  });
}

const startBackgroundLocationTracking = async (): Promise<boolean> => {
  try {
    const foreground = await Location.requestForegroundPermissionsAsync();
    if (foreground.status !== 'granted') {
      return false;
    }

    const background = await Location.requestBackgroundPermissionsAsync();
    if (background.status !== 'granted') {
      return false;
    }

    const alreadyStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (alreadyStarted) {
      return true;
    }

    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: MAP_UPDATE_INTERVAL,
      distanceInterval: 10,
      deferredUpdatesInterval: MAP_UPDATE_INTERVAL,
      pausesUpdatesAutomatically: false,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'OmniWatch patrol is active',
        notificationBody: 'Location tracking continues in background during patrol.',
      },
    });

    return true;
  } catch (error) {
    console.error('Error starting background location tracking:', error);
    return false;
  }
};

const stopBackgroundLocationTracking = async (explicitPatrolId?: string): Promise<void> => {
  try {
    await flushBufferedCoordinatesToServer(explicitPatrolId);
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    if (started) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch (error) {
    console.error('Error stopping background location tracking:', error);
  } finally {
    await AsyncStorage.removeItem(BACKGROUND_LOCATION_FILTER_STATE_KEY);
  }
};

export default function GuardDashboard() {
const router = useRouter();
const [activeTab, setActiveTab] = useState<'patrol' | 'logs' | 'details' | 'settings'>('patrol');
  const appStateRef = useRef(AppState.currentState);

  // State for locations and available areas
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [availableAreas, setAvailableAreas] = useState<string[]>([]);
  
  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  
  // Patrol Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingStatus, setRecordingStatus] = useState('');
  const [checkpointModalVisible, setCheckpointModalVisible] = useState(false);
  const [currentCheckpoint, setCurrentCheckpoint] = useState('');

  // Patrol History State
  const [patrolHistory, setPatrolHistory] = useState<PatrolData[]>([]);
  const [isLoadingPatrols, setIsLoadingPatrols] = useState(false);

  // Logs State
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [createLogModalVisible, setCreateLogModalVisible] = useState(false);
  const [newLogTitle, setNewLogTitle] = useState('');
  const [newLogDescription, setNewLogDescription] = useState('');
  const [newLogCategory, setNewLogCategory] = useState<'activity' | 'unusual' | 'incident' | 'checkpoint' | 'other'>('activity');
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  
  // Log image viewing state
  const [selectedLogImage, setSelectedLogImage] = useState<string | null>(null);
  const [logImageModalVisible, setLogImageModalVisible] = useState(false);

  // Persistent Patrol State
  const [patrolId, setPatrolId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [locationData, setLocationData] = useState<{latitude: number, longitude: number, timestamp: number}[]>([]);
  const [currentLocation, setCurrentLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const lastAcceptedForegroundPointRef = useRef<PatrolCoordinate | null>(null);
  const consecutiveForegroundMovementRef = useRef(0);

  const getElapsedSeconds = useCallback((startedAt: Date | null) => {
    if (!startedAt) return 0;
    const startMs = startedAt.getTime();
    if (Number.isNaN(startMs)) return 0;
    const elapsedMs = Date.now() - startMs;
    return Math.max(0, Math.floor(elapsedMs / 1000));
  }, []);

  const isPatrolOngoing = useCallback((status?: PatrolLifecycleStatus, endTime?: string) => {
    if (endTime) return false;
    if (!status) return false;
    return ACTIVE_PATROL_STATUSES.includes(status);
  }, []);

  const ensureForegroundPermission = useCallback(async () => {
    const existingPermission = await Location.getForegroundPermissionsAsync();
    if (existingPermission.status === 'granted') {
      return true;
    }

    const requestedPermission = await Location.requestForegroundPermissionsAsync();
    return requestedPermission.status === 'granted';
  }, []);

  const seedCurrentLocation = useCallback(async (setAsTrackingAnchor: boolean) => {
    try {
      const permissionGranted = await ensureForegroundPermission();
      if (!permissionGranted) {
        return false;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const sample = toLocationSample(location);
      setCurrentLocation({ latitude: sample.latitude, longitude: sample.longitude });

      if (setAsTrackingAnchor) {
        lastAcceptedForegroundPointRef.current = toPatrolCoordinate(sample);
      }

      return true;
    } catch (error) {
      console.error('Error seeding current location:', error);
      return false;
    }
  }, [ensureForegroundPermission]);
  
  // Guard Profile State - initialize with empty values
  const [guardProfile, setGuardProfile] = useState<GuardProfile>({
    name: '',
    id: '',
    operatingHours: {
      start: '18:00',
      end: '06:00',
    },
    assignmentLocation: 'Not assigned',
    assignmentLocationId: '',
    assignedAreas: [],
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [editableProfile, setEditableProfile] = useState<GuardProfile>(guardProfile);
  
  // Modals
  const [startTimeModalVisible, setStartTimeModalVisible] = useState(false);
  const [endTimeModalVisible, setEndTimeModalVisible] = useState(false);
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  // Dark Mode State
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Toggle dark mode
  const toggleDarkMode = async () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    // Save preference to AsyncStorage
    try {
      await AsyncStorage.setItem('darkMode', JSON.stringify(newMode));
    } catch (error) {
      console.error('Error saving dark mode preference:', error);
    }
  };

  // Load dark mode preference on mount
  useEffect(() => {
    const loadDarkModePreference = async () => {
      try {
        const savedMode = await AsyncStorage.getItem('darkMode');
        if (savedMode !== null) {
          setIsDarkMode(JSON.parse(savedMode));
        }
      } catch (error) {
        console.error('Error loading dark mode preference:', error);
      }
    };
    loadDarkModePreference();
  }, []);

  useEffect(() => {
    const lastPoint = locationData[locationData.length - 1] || null;
    lastAcceptedForegroundPointRef.current = lastPoint;
    if (!lastPoint) {
      consecutiveForegroundMovementRef.current = 0;
    }
  }, [locationData]);

  useEffect(() => {
    if (!currentLocation) {
      seedCurrentLocation(false);
    }
  }, [currentLocation, seedCurrentLocation]);

   // Start location tracking
  const startLocationTracking = useCallback(async () => {
    try {
      if (locationSubscription.current) {
        return;
      }

      const permissionGranted = await ensureForegroundPermission();
      if (!permissionGranted) {
        Alert.alert('Permission Denied', 'Location permission is required for patrol tracking.');
        return;
      }

      if (!lastAcceptedForegroundPointRef.current) {
        await seedCurrentLocation(true);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const sample = toLocationSample(location);
          const decision = shouldAcceptLocationSample(
            sample,
            lastAcceptedForegroundPointRef.current,
            consecutiveForegroundMovementRef.current
          );
          consecutiveForegroundMovementRef.current = decision.nextConsecutiveMovement;

          if (!decision.shouldAccept) {
            return;
          }

          const accepted = toPatrolCoordinate(sample);
          lastAcceptedForegroundPointRef.current = accepted;
          consecutiveForegroundMovementRef.current = 0;
          setCurrentLocation({ latitude: accepted.latitude, longitude: accepted.longitude });
          setLocationData(prev => [...prev, accepted]);
        }
      );
    } catch (error) {
      console.error('Error starting location tracking:', error);
    }
  }, [ensureForegroundPermission, seedCurrentLocation]);

  // Load persistent patrol data from AsyncStorage
  const loadPersistentPatrolData = useCallback(async (sessionUser?: UserData) => {
    try {
      const patrolData = await AsyncStorage.getItem(ONGOING_PATROL_STORAGE_KEY);
      if (patrolData) {
        const parsed = JSON.parse(patrolData);
        const parsedStartTime = parsed.startTime ? new Date(parsed.startTime) : null;
        const restoredPoints = Array.isArray(parsed.locationData) ? parsed.locationData : [];
        const restoredLastPoint = restoredPoints[restoredPoints.length - 1] || null;
        setIsRecording(true);
        setPatrolId(parsed.patrolId);
        setStartTime(parsedStartTime);
        setRecordingTime(getElapsedSeconds(parsedStartTime));
        setLocationData(restoredPoints);
        setCurrentLocation(
          restoredLastPoint
            ? { latitude: restoredLastPoint.latitude, longitude: restoredLastPoint.longitude }
            : null
        );
        lastAcceptedForegroundPointRef.current = restoredLastPoint;
        consecutiveForegroundMovementRef.current = 0;
        setRecordingStatus('Patrol resumed from previous session');

        // Resume location tracking
        await startBackgroundLocationTracking();
        startLocationTracking();
        return;
      }

      const serverPatrol = sessionUser?.ongoing_patrol;
      if (serverPatrol && isPatrolOngoing(serverPatrol.status, serverPatrol.end_time)) {
        const patrolStart = serverPatrol.start_time ? new Date(serverPatrol.start_time) : null;

        setIsRecording(true);
        setPatrolId(serverPatrol.id);
        setStartTime(patrolStart);
        setRecordingTime(getElapsedSeconds(patrolStart));
        setLocationData([]);
        setCurrentLocation(null);
        lastAcceptedForegroundPointRef.current = null;
        consecutiveForegroundMovementRef.current = 0;
        setRecordingStatus(
          sessionUser?.patrol_status === 'logged_out_on_patrol'
            ? 'Patrol is still ongoing. You were logged out during patrol and tracking has resumed.'
            : 'Patrol resumed from server state'
        );

        await AsyncStorage.setItem(
          ONGOING_PATROL_STORAGE_KEY,
          JSON.stringify({
            patrolId: serverPatrol.id,
            startTime: serverPatrol.start_time,
            locationData: [],
          })
        );

        await startBackgroundLocationTracking();
        startLocationTracking();
      }
    } catch (error) {
      console.error('Error loading persistent patrol data:', error);
    }
  }, [startLocationTracking, isPatrolOngoing, getElapsedSeconds]);

  // Load user session on mount
  useEffect(() => {
    const loadUserSession = async () => {
    try {
      setIsLoading(true);
      const { token, userData: storedUserData } = await getUserSession();

      if (!token || !storedUserData) {
        // No session found, redirect to login
        Alert.alert(
          'Session Expired',
          'Please login again to continue.',
          [{ text: 'OK', onPress: () => router.replace('/login') }]
        );
        return;
      }

      // Check if user is a guard
      if (storedUserData.role !== 'guard') {
        // Not a guard, redirect based on role
        if (storedUserData.role === 'admin' || storedUserData.role === 'supervisor') {
          router.replace('/admin_dash');
        } else {
          Alert.alert(
            'Access Denied',
            'You do not have permission to access this page.',
            [{ text: 'OK', onPress: () => router.replace('/login') }]
          );
        }
        return;
      }

      setUserData(storedUserData);

      // Initialize guard profile from session data
      const initialProfile: GuardProfile = {
        name: `${storedUserData.first_name} ${storedUserData.last_name}`,
        id: `GND-${storedUserData.id}`,
        operatingHours: {
          start: '18:00',
          end: '06:00',
        },
        assignmentLocation: 'Not assigned',
        assignmentLocationId: '',
        assignedAreas: [],
      };

      // Fetch locations and available areas before processing assignments
      const fetchedLocations = await fetchLocationsAndAreas(token, storedUserData.invite_code);

      // If assignments exist in session, find the one that matches the user_id
      if (storedUserData.assignments && storedUserData.assignments.length > 0) {
        const userAssignment = storedUserData.assignments.find((assignment: { user_id: any; }) => assignment.user_id === storedUserData.id);
        if (userAssignment) {
          const assignedLocation = fetchedLocations.find(loc => loc.id === userAssignment.location);
          if (assignedLocation) {
            initialProfile.assignmentLocation = assignedLocation.name;
            initialProfile.assignmentLocationId = assignedLocation.id;
          }
          if (userAssignment.assigned_areas) {
            initialProfile.assignedAreas = userAssignment.assigned_areas.split(',').map((area: string) => area.trim());
          }
          initialProfile.operatingHours.start = userAssignment.start_time;
          initialProfile.operatingHours.end = userAssignment.end_time;
        } else {
          // If no assignment matches, use the first one as fallback
          const assignment = storedUserData.assignments[0];
          const assignedLocation = fetchedLocations.find(loc => loc.id === assignment.location);
          if (assignedLocation) {
            initialProfile.assignmentLocation = assignedLocation.name;
            initialProfile.assignmentLocationId = assignedLocation.id;
          }
          if (assignment.assigned_areas) {
            initialProfile.assignedAreas = assignment.assigned_areas.split(',').map((area: string) => area.trim());
          }
          initialProfile.operatingHours.start = assignment.start_time;
          initialProfile.operatingHours.end = assignment.end_time;
        }
      } else {
        // Fetch assignments from backend if not in session
        await fetchAssignments(token, initialProfile, fetchedLocations);
      }

      // After initialProfile is set, populate availableAreas based on the initial assignment location
      const initialAssignmentLocation = fetchedLocations.find(loc => loc.id === initialProfile.assignmentLocationId);
      if (initialAssignmentLocation && initialAssignmentLocation.assigned_areas) {
        setAvailableAreas(initialAssignmentLocation.assigned_areas.split(',').map(area => area.trim()));
      }

      setGuardProfile(initialProfile);
      setEditableProfile(initialProfile);

      // Load persistent patrol data after session is loaded
      await loadPersistentPatrolData(storedUserData);
      
      // Fetch patrol history
      await fetchPatrolHistory();
      
      // Fetch logs
      await fetchLogs();
    } catch (error) {
      console.error('Error loading session:', error);
      Alert.alert('Error', 'Failed to load user data. Please login again.');
      router.replace('/login');
    } finally {
      setIsLoading(false);
    }
    };

    loadUserSession();
  }, [router, loadPersistentPatrolData]);

  // Fetch assignments from backend
  const fetchAssignments = async (token: string, profile: GuardProfile, locations: {id: string, name: string}[]) => {
    try {
      const response = await fetch(`${API_URL}/my-assignments`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.assignments && data.assignments.length > 0) {
          const assignment = data.assignments[0];
          // Resolve location name from ID
          const assignedLocation = locations.find(loc => loc.id === assignment.location);
          if (assignedLocation) {
            profile.assignmentLocation = assignedLocation.name;
            profile.assignmentLocationId = assignedLocation.id;
          } else {
            profile.assignmentLocation = 'Not assigned';
            profile.assignmentLocationId = assignment.location;
          }
          
          if (assignment.assigned_areas) {
            profile.assignedAreas = assignment.assigned_areas.split(',').map((area: string) => area.trim());
          } else {
            profile.assignedAreas = [];
          }
          
          profile.operatingHours.start = assignment.start_time;
          profile.operatingHours.end = assignment.end_time;
        }
      }
    } catch (error) {
      console.error('Error fetching assignments:', error);
    }
  };

  // Fetch locations and available areas from backend
  const fetchLocationsAndAreas = async (token: string, inviteCode: string) => {
    let fetchedLocations: LocationData[] = [];
    try {
      // Fetch locations
      const locationsResponse = await fetch(`${API_URL}/locations`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (locationsResponse.ok) {
        const locationsData = await locationsResponse.json();
        fetchedLocations = locationsData.locations.map((loc: any) => loc as LocationData);
        setLocations(fetchedLocations);


      } else {
        // If locations can't be fetched, at least try to get areas from assignments
        const assignmentsResponse = await fetch(`${API_URL}/my-assignments`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (assignmentsResponse.ok) {
          const assignmentsData = await assignmentsResponse.json();
          if (assignmentsData.assignments && assignmentsData.assignments.length > 0) {
            const assignment = assignmentsData.assignments[0];
            if (assignment.assigned_areas) {
              const areas = assignment.assigned_areas.split(',').map((area: string) => area.trim());
              setAvailableAreas(areas);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching locations and areas:', error);
    }
    return fetchedLocations;
  };

  // Fetch patrol history from API
  const fetchPatrolHistory = async () => {
    try {
      setIsLoadingPatrols(true);
      const { token } = await getUserSession();
      
      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/patrols?limit=10&sort=-start_time`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPatrolHistory(data.patrols || []);
      } else {
        console.error('Failed to fetch patrols:', response.status);
      }
    } catch (error) {
      console.error('Error fetching patrol history:', error);
    } finally {
      setIsLoadingPatrols(false);
    }
  };

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setIsLoadingLogs(true);
      const { token } = await getUserSession();
      
      if (!token) {
        return;
      }

      const response = await fetch(`${API_URL}/logs?limit=50&sort=-timestamp`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      } else {
        console.error('Failed to fetch logs:', response.status);
      }
    } catch (error) {
      console.error('Error fetching logs:', error);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  // Create a new log entry
  const createLog = async () => {
    if (!newLogTitle.trim() || !newLogDescription.trim()) {
      Alert.alert('Error', 'Please enter a title and description');
      return;
    }

    try {
      setIsSubmittingLog(true);
      const { token } = await getUserSession();
      
      if (!token) {
        Alert.alert('Error', 'Session not found. Please login again.');
        return;
      }

      const response = await fetch(`${API_URL}/logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newLogTitle.trim(),
          description: newLogDescription.trim(),
          category: newLogCategory,
          patrol_id: patrolId,
          images: selectedImages.length > 0 ? JSON.stringify(selectedImages) : null,
        }),
      });

      if (response.ok) {
        // const data = await response.json();
        Alert.alert('Success', 'Log created successfully');
        
        // Reset form
        resetLogForm();
        
        // Refresh logs
        await fetchLogs();
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to create log');
      }
    } catch (error) {
      console.error('Error creating log:', error);
      Alert.alert('Error', 'Failed to create log. Please try again.');
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Get category info helper
  const getCategoryInfo = (category: string) => {
    return LOG_CATEGORIES.find(c => c.value === category) || LOG_CATEGORIES[4];
  };

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera roll permissions to add images.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];
        // Use base64 if available, otherwise use the URI
        if (image.base64) {
          setSelectedImages(prev => [...prev, `data:image/jpeg;base64,${image.base64}`]);
        } else {
          // For local URIs, we'll need to handle differently
          Alert.alert('Info', 'Image selected. Note: For best results, please use base64 images.');
        }
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  // Take photo with camera
  const takePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permissions to take photos.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const image = result.assets[0];
        if (image.base64) {
          setSelectedImages(prev => [...prev, `data:image/jpeg;base64,${image.base64}`]);
        } else {
          Alert.alert('Info', 'Photo taken. Note: For best results, please use base64 images.');
        }
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  // Remove selected image
  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Reset log form
  const resetLogForm = () => {
    setNewLogTitle('');
    setNewLogDescription('');
    setNewLogCategory('activity');
    setSelectedImages([]);
    setCreateLogModalVisible(false);
  };

 

  // Stop location tracking
  const stopLocationTracking = () => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    consecutiveForegroundMovementRef.current = 0;
  };

  // Send periodic location update to server
  const sendPeriodicLocationUpdate = useCallback(async () => {
    await flushBufferedCoordinatesToServer(patrolId || undefined);

    if (!patrolId || locationData.length === 0) {
      return;
    }

    try {
      const { token } = await getUserSession();
      if (!token) {
        console.error('No auth token found for location update');
        return;
      }

      // Get the last few location points (since last update)
      // We'll send all points since the patrol started, server will append
      const locationPoints = locationData.map((point) => ({
        latitude: point.latitude,
        longitude: point.longitude,
        timestamp: point.timestamp,
      }));

      const response = await fetch(`${API_URL}/patrols/${patrolId}/location`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location_data: locationPoints,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Location update sent successfully, total points:', data.points_count);
      } else {
        console.error('Failed to send location update:', response.status);
      }
    } catch (error) {
      console.error('Error sending periodic location update:', error);
    }
  }, [patrolId, locationData]);

  // Periodic location update effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    if (isRecording && patrolId) {
      // Set up interval to send location updates every 30 seconds
      interval = setInterval(() => {
        sendPeriodicLocationUpdate();
      }, MAP_UPDATE_INTERVAL);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isRecording, patrolId, locationData, sendPeriodicLocationUpdate]);

  // Handle logout - show custom modal instead of Alert
  const handleLogout = () => {
    setLogoutModalVisible(true);
  };

  // Perform the actual logout
  const performLogout = async () => {
    setLogoutModalVisible(false);

    if (isRecording || patrolId) {
      Alert.alert('Patrol Ongoing', 'You cannot logout while on patrol. End the patrol first.');
      return;
    }

    try {
      await stopBackgroundLocationTracking(patrolId || undefined);

      const { token } = await getUserSession();
      if (token) {
        const response = await fetch(`${API_URL}/logout`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          if (response.status === 409 || payload?.code === 'ACTIVE_PATROL_LOGOUT_BLOCKED') {
            Alert.alert('Patrol Ongoing', payload?.message || 'End the active patrol before logout.');
            return;
          }
          throw new Error(payload?.message || `Logout failed (${response.status})`);
        }
      }

      // Clear user session
      await clearUserSession();
      
      // Clear persistent patrol data
      await AsyncStorage.removeItem(ONGOING_PATROL_STORAGE_KEY);
      
      // Navigate to login
      router.replace('/login');
    } catch (error) {
      console.error('Logout error:', error);
      Alert.alert('Error', 'Failed to logout. Please try again.');
    }
  };

  // Recording timer effect
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isRecording && startTime) {
      interval = setInterval(() => {
        setRecordingTime(getElapsedSeconds(startTime));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, startTime, getElapsedSeconds]);

  // Keep timer accurate across app background/foreground transitions
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const wasInBackground = appStateRef.current.match(/inactive|background/);
      if (wasInBackground && nextAppState === 'active' && isRecording && startTime) {
        setRecordingTime(getElapsedSeconds(startTime));
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isRecording, startTime, getElapsedSeconds]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      stopLocationTracking();
    };
  }, []);

  // Format time display
  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle patrol recording
  const toggleRecording = async () => {
    if (isRecording) {
      const currentDuration = getElapsedSeconds(startTime);
      // Stop recording
      Alert.alert(
        'End Patrol',
        `Patrol duration: ${formatTime(currentDuration)}\nRecorded checkpoints will be submitted.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'End Patrol',
            style: 'destructive',
            onPress: async () => {
              try {
                // Stop location tracking
                stopLocationTracking();
                await stopBackgroundLocationTracking(patrolId || undefined);
                const finalDuration = getElapsedSeconds(startTime);

                // Update patrol record in Directus
                if (patrolId) {
                  const { token } = await getUserSession();
                  if (!token) {
                    throw new Error('No auth token found while ending patrol');
                  }
                  const endTime = new Date().toISOString();
                  const mapCoordinates = locationData.map((point) => ({
                    latitude: point.latitude,
                    longitude: point.longitude,
                    timestamp: point.timestamp,
                  }));
                  const mapJson = JSON.stringify(mapCoordinates);

                  const patchResponse = await fetch(`${API_URL}/patrols/${patrolId}`, {
                    method: 'PATCH',
                    headers: {
                      'Authorization': `Bearer ${token}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      organization_id: userData?.invite_code || null,
                      user_id: userData?.id || null,
                      duration: finalDuration,
                      start_time: startTime?.toISOString() || null,
                      end_time: endTime,
                      map: mapJson,
                    }),
                  });
                  if (!patchResponse.ok) {
                    const errText = await patchResponse.text();
                    throw new Error(`Failed to end patrol (${patchResponse.status}): ${errText}`);
                  }
                  const patchData = await patchResponse.json();
                  if (patchData?.warning === 'duration_not_saved') {
                    console.warn('Duration was not persisted:', patchData?.details);
                    Alert.alert(
                      'Patrol Saved With Warning',
                      'Patrol end time/map saved, but duration could not be persisted. Check backend field configuration for duration.'
                    );
                  }

                  // Clear persistent patrol data
                  await AsyncStorage.removeItem(ONGOING_PATROL_STORAGE_KEY);
                }

                setIsRecording(false);
                setPatrolId(null);
                setStartTime(null);
                setLocationData([]);
                setCurrentLocation(null);
                lastAcceptedForegroundPointRef.current = null;
                consecutiveForegroundMovementRef.current = 0;
                setRecordingStatus('Patrol completed successfully');
                setRecordingTime(0);
                
                // Refresh patrol history
                await fetchPatrolHistory();
                
                setTimeout(() => setRecordingStatus(''), 3000);
              } catch (error) {
                console.error('Error ending patrol:', error);
                Alert.alert('Error', 'Failed to save patrol data. Please try again.');
              }
            }
          }
        ]
      );
    } else {
      // Start recording
      try {
        const { token, userData: storedUserData } = await getUserSession();
        if (!token || !storedUserData) {
          Alert.alert('Error', 'Session not found. Please login again.');
          return;
        }

        const orgId = storedUserData.invite_code || null;
        const now = new Date().toISOString();

        // Create patrol record in Directus
        const response = await fetch(`${API_URL}/patrols`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            start_time: now,
            user_id: storedUserData.id,
            organization_id: orgId,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const newPatrolId = data.data?.id || data.id;
          const startDate = new Date(now);
          setPatrolId(newPatrolId);
          setStartTime(startDate);

          // Persist patrol data to AsyncStorage
          await AsyncStorage.setItem(ONGOING_PATROL_STORAGE_KEY, JSON.stringify({
            patrolId: newPatrolId,
            startTime: now,
            locationData: [],
          }));
        }

        setIsRecording(true);
        setRecordingTime(0);
        setLocationData([]);
        setCurrentLocation(null);
        lastAcceptedForegroundPointRef.current = null;
        consecutiveForegroundMovementRef.current = 0;
        setRecordingStatus('Patrol recording started');
        setTimeout(() => setRecordingStatus(''), 3000);

        await AsyncStorage.multiRemove([
          BACKGROUND_LOCATION_BUFFER_KEY,
          BACKGROUND_LAST_SENT_AT_KEY,
          BACKGROUND_LOCATION_FILTER_STATE_KEY,
        ]);

        // Start location tracking
        const backgroundStarted = await startBackgroundLocationTracking();
        if (!backgroundStarted) {
          Alert.alert(
            'Background Tracking Disabled',
            'Background location permission was not granted. Coordinates will only sync while the app is open.'
          );
        }
        startLocationTracking();
      } catch (error) {
        console.error('Error starting patrol:', error);
        Alert.alert('Error', 'Failed to start patrol. Please try again.');
      }
    }
  };

  // Handle checkpoint logging
  const logCheckpoint = (area: string) => {
    setCurrentCheckpoint(area);
    setCheckpointModalVisible(true);
  };

  const submitCheckpoint = (note: string) => {
    Alert.alert('Checkpoint Logged', `Area: ${currentCheckpoint}\nNote: ${note || 'None'}`);
    setCheckpointModalVisible(false);
    setCurrentCheckpoint('');
  };

  // Handle area toggle
  const toggleArea = (area: string) => {
    const newAreas = editableProfile.assignedAreas.includes(area)
      ? editableProfile.assignedAreas.filter((a) => a !== area)
      : [...editableProfile.assignedAreas, area];
    setEditableProfile({ ...editableProfile, assignedAreas: newAreas });
  };

  // Handle time selection
  const selectTime = (time: string, type: 'start' | 'end') => {
    setEditableProfile({
      ...editableProfile,
      operatingHours: { ...editableProfile.operatingHours, [type]: time },
    });
    setStartTimeModalVisible(false);
    setEndTimeModalVisible(false);
  };

  // Handle location selection
  const selectLocation = (location: LocationData) => {
    const newAvailableAreas = location.assigned_areas ?
      location.assigned_areas.split(',').map(area => area.trim()) :
      [];

    setAvailableAreas(newAvailableAreas); // Update available areas for selection

    // Also reset assigned areas to be empty, as per user's implicit request "not selected"
    setEditableProfile({
      ...editableProfile,
      assignmentLocation: location.name,
      assignmentLocationId: location.id,
      assignedAreas: [], // When location changes, clear current assigned areas for new selection
    });
    setLocationModalVisible(false);
  };

  // Save profile changes
  const saveProfile = async () => {
    try {
      const { token } = await getUserSession();
      if (!token) {
        Alert.alert('Error', 'Session not found. Please login again.');
        return;
      }

      const updateData = {
        location: editableProfile.assignmentLocationId,
        assigned_areas: editableProfile.assignedAreas.join(','),
        start_time: editableProfile.operatingHours.start,
        end_time: editableProfile.operatingHours.end,
      };

      const response = await fetch(`${API_URL}/my-assignments`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      if (response.ok) {
        setGuardProfile(editableProfile);
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        const errorData = await response.json();
        Alert.alert('Error', errorData.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    }
  };

  // Render Patrol Tab
  const renderPatrolTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Recording Status Card */}
      <View style={styles.card}>
        <View style={styles.recordingStatusContainer}>
          <View style={[styles.recordingIndicator, isRecording && styles.recordingActive]} />
          <Text style={styles.recordingStatusText}>
            {isRecording ? 'Recording in Progress' : 'Ready for Patrol'}
          </Text>
        </View>
        
        {isRecording && (
          <View style={styles.timerContainer}>
            <Text style={styles.timerText}>{formatTime(recordingTime)}</Text>
          </View>
        )}
        
        {recordingStatus !== '' && (
          <View style={styles.statusMessage}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.statusMessageText}>{recordingStatus}</Text>
          </View>
        )}

        {/* Map View */}
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            initialRegion={{
              latitude: currentLocation?.latitude || -26.2041, // Default to Johannesburg
              longitude: currentLocation?.longitude || 28.0473,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            region={currentLocation ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            } : undefined}
          >
            {currentLocation && (
              <Marker
                coordinate={currentLocation}
                title="Current Location"
                description="Your current position"
              />
            )}
            {locationData.length > 1 && (
              <Polyline
                coordinates={locationData.map(loc => ({
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                }))}
                strokeColor="#2563eb"
                strokeWidth={3}
              />
            )}
          </MapView>
        </View>

        <TouchableOpacity
          style={[styles.mainButton, isRecording && styles.stopButton]}
          onPress={toggleRecording}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'play-circle'}
            size={48}
            color="#fff"
          />
          <Text style={styles.mainButtonText}>
            {isRecording ? 'Stop Recording' : 'Start Patrol'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Quick Checkpoints */}
      <Text style={styles.sectionTitle}>Quick Checkpoints</Text>
      <View style={styles.checkpointGrid}>
        {guardProfile.assignedAreas.map((area) => (
          <TouchableOpacity
            key={area}
            style={[styles.checkpointButton, isRecording && styles.checkpointActive]}
            onPress={() => isRecording && logCheckpoint(area)}
            disabled={!isRecording}
          >
            <Ionicons 
              name={isRecording ? 'location' : 'location-outline'} 
              size={24} 
              color={isRecording ? '#fff' : '#64748b'} 
            />
            <Text style={[styles.checkpointText, !isRecording && styles.checkpointTextDisabled]}>
              {area}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Patrol History */}
      <Text style={styles.sectionTitle}>Recent Patrols</Text>
      {isLoadingPatrols ? (
        <View style={styles.historyLoadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.historyLoadingText}>Loading patrols...</Text>
        </View>
      ) : patrolHistory.length > 0 ? (
        <View style={styles.historyContainer}>
          {patrolHistory.map((patrol) => {
            // Calculate duration if both start and end times exist
            let duration = 'N/A';
            if (patrol.start_time && patrol.end_time) {
              const start = new Date(patrol.start_time);
              const end = new Date(patrol.end_time);
              const diffMs = end.getTime() - start.getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const hrs = Math.floor(diffMins / 60);
              const mins = diffMins % 60;
              duration = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
            } else if (patrol.start_time && isPatrolOngoing(patrol.status, patrol.end_time)) {
              duration = 'In Progress';
            }

            // Format the date
            const patrolDate = patrol.start_time 
              ? new Date(patrol.start_time).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Unknown';

            return (
              <View key={patrol.id} style={styles.historyItem}>
                <View style={styles.historyIcon}>
                  <Ionicons name="walk" size={20} color="#2563eb" />
                </View>
                <View style={styles.historyInfo}>
                  <Text style={styles.historyTitle}>
                    Patrol #{patrol.id.slice(-4).toUpperCase()}
                  </Text>
                  <Text style={styles.historySubtitle}>
                    {patrolDate}
                  </Text>
                </View>
                <View style={styles.historyDuration}>
                  <Text style={styles.historyDurationText}>{duration}</Text>
                  <Text style={styles.historyLabel}>
                    {isPatrolOngoing(patrol.status, patrol.end_time) ? 'Active' : 'Duration'}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.historyEmptyContainer}>
          <Ionicons name="shield-checkmark" size={40} color="#64748b" />
          <Text style={styles.historyEmptyText}>No patrols recorded yet</Text>
          <Text style={styles.historyEmptySubtext}>Start your first patrol to see history</Text>
        </View>
      )}
    </ScrollView>
  );

  // Render Personal Details Tab
  const renderDetailsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Guard Info Card */}
      <View style={styles.card}>
        <View style={styles.guardHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {guardProfile.name.split(' ').map((n) => n[0]).join('')}
            </Text>
          </View>
          <View style={styles.guardInfo}>
            <Text style={styles.guardName}>{guardProfile.name}</Text>
            <Text style={styles.guardId}>ID: {guardProfile.id}</Text>
          </View>
          <TouchableOpacity 
            style={styles.editButton}
            onPress={() => {
              setEditableProfile(guardProfile);
              setIsEditing(true);
            }}
          >
            <Ionicons name="create-outline" size={20} color="#2563eb" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Operating Hours */}
      <Text style={styles.sectionTitle}>Operating Hours</Text>
      <View style={styles.card}>
        <View style={styles.timeRow}>
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>Start Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => isEditing && setStartTimeModalVisible(true)}
              disabled={!isEditing}
            >
              <Ionicons name="time" size={20} color="#2563eb" />
              <Text style={styles.timeValue}>{editableProfile.operatingHours.start}</Text>
              {isEditing && <Ionicons name="chevron-down" size={16} color="#64748b" />}
            </TouchableOpacity>
          </View>
          <View style={styles.timeItem}>
            <Text style={styles.timeLabel}>End Time</Text>
            <TouchableOpacity 
              style={styles.timeButton}
              onPress={() => isEditing && setEndTimeModalVisible(true)}
              disabled={!isEditing}
            >
              <Ionicons name="moon" size={20} color="#2563eb" />
              <Text style={styles.timeValue}>{editableProfile.operatingHours.end}</Text>
              {isEditing && <Ionicons name="chevron-down" size={16} color="#64748b" />}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Assignment Location */}
      <Text style={styles.sectionTitle}>Assignment Location</Text>
      <View style={styles.card}>
        <TouchableOpacity 
          style={styles.locationButton}
          onPress={() => isEditing && setLocationModalVisible(true)}
          disabled={!isEditing}
        >
          <View style={styles.locationLeft}>
            <Ionicons name="location" size={20} color="#2563eb" />
            <Text style={styles.locationLabel}>
              {editableProfile.assignmentLocation || 'Select Location'}
            </Text>
          </View>
          {isEditing && (
            <Ionicons name="chevron-down" size={20} color="#64748b" />
          )}
        </TouchableOpacity>
      </View>

      {/* Assigned Areas */}
      <Text style={styles.sectionTitle}>Assigned Areas</Text>
      <View style={styles.card}>
        <View style={styles.areasGrid}>
          {availableAreas.map((area: string) => {
            const isSelected = editableProfile.assignedAreas.includes(area);
            return (
              <TouchableOpacity
                key={area}
                style={[
                  styles.areaItem,
                  isSelected && styles.areaItemSelected,
                  !isEditing && !isSelected && styles.areaItemDisabled,
                ]}
                onPress={() => isEditing && toggleArea(area)}
                disabled={!isEditing}
              >
                {isSelected && (
                  <Ionicons name="checkmark-circle" size={18} color="#fff" style={{ marginRight: 6 }} />
                )}
                <Text style={[
                  styles.areaText,
                  isSelected && styles.areaTextSelected,
                ]}>
                  {area}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Save Button */}
      {isEditing && (
        <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
          <Text style={styles.saveButtonText}>Save Changes</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );

  // Render Logs Tab
  const renderLogsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Stats */}
      <View style={styles.logsStatsContainer}>
        <View style={styles.logsStatCard}>
          <Ionicons name="document-text" size={24} color="#2563eb" />
          <Text style={styles.logsStatNumber}>{logs.length}</Text>
          <Text style={styles.logsStatLabel}>Total Logs</Text>
        </View>
        <View style={styles.logsStatCard}>
          <Ionicons name="warning" size={24} color="#f59e0b" />
          <Text style={styles.logsStatNumber}>
            {logs.filter(l => l.category === 'unusual' || l.category === 'incident').length}
          </Text>
          <Text style={styles.logsStatLabel}>Unusual/Incident</Text>
        </View>
      </View>

      {/* Logs List */}
      <Text style={styles.sectionTitle}>Recent Logs</Text>
      {isLoadingLogs ? (
        <View style={styles.historyLoadingContainer}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.historyLoadingText}>Loading logs...</Text>
        </View>
      ) : logs.length > 0 ? (
        <View style={styles.logsContainer}>
          {logs.map((log) => {
            const categoryInfo = getCategoryInfo(log.category);
            const logDate = log.timestamp 
              ? new Date(log.timestamp).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Unknown';

            return (
              <View key={log.id} style={styles.logsCard}>
                <View style={styles.logsHeader}>
                  <View style={[styles.logsIcon, { backgroundColor: categoryInfo.color + '20' }]}>
                    <Ionicons name={categoryInfo.icon as any} size={20} color={categoryInfo.color} />
                  </View>
                  <View style={styles.logsInfo}>
                    <Text style={styles.logsTitle}>{log.title}</Text>
                    <Text style={styles.logsDate}>{logDate}</Text>
                  </View>
                  <View style={[styles.logsCategoryBadge, { backgroundColor: categoryInfo.color + '20' }]}>
                    <Text style={[styles.logsCategoryText, { color: categoryInfo.color }]}>
                      {categoryInfo.label}
                    </Text>
                  </View>
                </View>
                <Text style={styles.logsDescription} numberOfLines={2}>
                  {log.description}
                </Text>
                {log.images && (
                  <View style={styles.logsImagesContainer}>
                    {(() => {
                      try {
                        const images = JSON.parse(log.images);
                        if (Array.isArray(images) && images.length > 0) {
                          return (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.logsImagesScroll}>
                              {images.map((imgUri: string, index: number) => (
                                <TouchableOpacity 
                                  key={index}
                                  onPress={() => {
                                    // Set selected image for viewing
                                    setSelectedLogImage(imgUri);
                                    setLogImageModalVisible(true);
                                  }}
                                >
                                  <Image
                                    source={{ uri: imgUri }}
                                    style={styles.logsImageThumbnail}
                                  />
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          );
                        }
                      } catch (e) {
                        console.error('Error parsing images:', e);
                      }
                      return null;
                    })()}
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.historyEmptyContainer}>
          <Ionicons name="document-text-outline" size={40} color="#64748b" />
          <Text style={styles.historyEmptyText}>No logs recorded yet</Text>
          <Text style={styles.historyEmptySubtext}>Tap + to add your first log</Text>
        </View>
      )}

      {/* Floating Action Button for adding logs */}
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => setCreateLogModalVisible(true)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </ScrollView>
  );

  // Render Settings Tab
  const renderSettingsTab = () => (
    <ScrollView style={styles.tabContent}>
      {/* Account Settings */}
      <Text style={styles.sectionTitle}>Account Settings</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.settingRow} onPress={() => setActiveTab('details')}>
          <View style={styles.settingLeft}>
            <Ionicons name="person" size={20} color="#2563eb" />
            <Text style={styles.settingText}>Profile Information</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/settings')}>
          <View style={styles.settingLeft}>
            <Ionicons name="notifications" size={20} color="#2563eb" />
            <Text style={styles.settingText}>Notification Preferences</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* App Settings */}
      <Text style={styles.sectionTitle}>App Settings</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.settingRow} onPress={toggleDarkMode}>
          <View style={styles.settingLeft}>
            <Ionicons name={isDarkMode ? 'moon' : 'sunny'} size={20} color="#2563eb" />
            <Text style={styles.settingText}>Dark Mode</Text>
          </View>
          <Ionicons 
            name={isDarkMode ? 'toggle' : 'toggle-outline'} 
            size={24} 
            color={isDarkMode ? '#2563eb' : '#64748b'} 
          />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/about')}>
          <View style={styles.settingLeft}>
            <Ionicons name="information-circle" size={20} color="#2563eb" />
            <Text style={styles.settingText}>About</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Support */}
      <Text style={styles.sectionTitle}>Support</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/support')}>
          <View style={styles.settingLeft}>
            <Ionicons name="help-circle" size={20} color="#2563eb" />
            <Text style={styles.settingText}>Help & Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.settingRow} onPress={() => router.push('/support')}>
          <View style={styles.settingLeft}>
            <Ionicons name="chatbubble" size={20} color="#2563eb" />
            <Text style={styles.settingText}>Contact Support</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#64748b" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  // Show loading screen while fetching session data
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Guard Dashboard</Text>
          <Text style={styles.headerSubtitle}>{guardProfile.name}</Text>
        </View>
        <TouchableOpacity 
          onPress={handleLogout}
          style={styles.headerLogoutButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="log-out-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'patrol' ? renderPatrolTab() :
         activeTab === 'logs' ? renderLogsTab() :
         activeTab === 'details' ? renderDetailsTab() :
         renderSettingsTab()}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => setActiveTab('patrol')}
        >
          <Ionicons 
            name={activeTab === 'patrol' ? 'videocam' : 'videocam-outline'} 
            size={26} 
            color={activeTab === 'patrol' ? '#2563eb' : '#94a3b8'} 
          />
          <Text style={[styles.bottomTabText, activeTab === 'patrol' && styles.bottomTabActive]}>
            Patrol
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => setActiveTab('logs')}
        >
          <Ionicons 
            name={activeTab === 'logs' ? 'document-text' : 'document-text-outline'} 
            size={26} 
            color={activeTab === 'logs' ? '#2563eb' : '#94a3b8'} 
          />
          <Text style={[styles.bottomTabText, activeTab === 'logs' && styles.bottomTabActive]}>
            Logs
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => setActiveTab('details')}
        >
          <Ionicons 
            name={activeTab === 'details' ? 'person' : 'person-outline'} 
            size={26} 
            color={activeTab === 'details' ? '#2563eb' : '#94a3b8'} 
          />
          <Text style={[styles.bottomTabText, activeTab === 'details' && styles.bottomTabActive]}>
            Details
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.bottomTab}
          onPress={() => setActiveTab('settings')}
        >
          <Ionicons 
            name={activeTab === 'settings' ? 'settings' : 'settings-outline'} 
            size={26} 
            color={activeTab === 'settings' ? '#2563eb' : '#94a3b8'} 
          />
          <Text style={[styles.bottomTabText, activeTab === 'settings' && styles.bottomTabActive]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      {/* Checkpoint Modal */}
      <Modal
        visible={checkpointModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCheckpointModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Checkpoint</Text>
            <Text style={styles.modalSubtitle}>{currentCheckpoint}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Add notes (optional)"
              placeholderTextColor="#64748b"
              multiline
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setCheckpointModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmit]}
                onPress={() => submitCheckpoint('')}
              >
                <Text style={styles.modalSubmitText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Start Time Picker Modal */}
      <Modal
        visible={startTimeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setStartTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.pickerModalContent]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Start Time</Text>
              <TouchableOpacity onPress={() => setStartTimeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.pickerItem,
                    editableProfile.operatingHours.start === time && styles.pickerItemSelected,
                  ]}
                  onPress={() => selectTime(time, 'start')}
                >
                  <Text style={[
                    styles.pickerItemText,
                    editableProfile.operatingHours.start === time && styles.pickerItemTextSelected,
                  ]}>
                    {time}
                  </Text>
                  {editableProfile.operatingHours.start === time && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* End Time Picker Modal */}
      <Modal
        visible={endTimeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEndTimeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.pickerModalContent]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select End Time</Text>
              <TouchableOpacity onPress={() => setEndTimeModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {TIME_SLOTS.map((time) => (
                <TouchableOpacity
                  key={time}
                  style={[
                    styles.pickerItem,
                    editableProfile.operatingHours.end === time && styles.pickerItemSelected,
                  ]}
                  onPress={() => selectTime(time, 'end')}
                >
                  <Text style={[
                    styles.pickerItemText,
                    editableProfile.operatingHours.end === time && styles.pickerItemTextSelected,
                  ]}>
                    {time}
                  </Text>
                  {editableProfile.operatingHours.end === time && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Location Picker Modal */}
      <Modal
        visible={locationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.pickerModalContent]}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Assignment Location</Text>
              <TouchableOpacity onPress={() => setLocationModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {locations.map((location) => (
                <TouchableOpacity
                  key={location.id}
                  style={[
                    styles.pickerItem,
                    editableProfile.assignmentLocationId === location.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => selectLocation(location)}
                >
                  <View style={styles.pickerItemContent}>
                    <Ionicons name="location-outline" size={20} color={editableProfile.assignmentLocationId === location.id ? '#fff' : '#94a3b8'} />
                    <Text style={[
                      styles.pickerItemText,
                      editableProfile.assignmentLocationId === location.id && styles.pickerItemTextSelected,
                    ]}>
                      {location.name}
                    </Text>
                  </View>
                  {editableProfile.assignmentLocationId === location.id && (
                    <Ionicons name="checkmark" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Custom Logout Confirmation Modal */}
      <Modal
        visible={logoutModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogoutModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Logout</Text>
            <Text style={styles.modalSubtitle}>Are you sure you want to logout?</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => {
                  setLogoutModalVisible(false);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmit]}
                onPress={performLogout}
              >
                <Text style={styles.modalSubmitText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal
        visible={logImageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLogImageModalVisible(false)}
      >
        <View style={styles.imageViewerOverlay}>
          <TouchableOpacity 
            style={styles.imageViewerCloseButton}
            onPress={() => setLogImageModalVisible(false)}
          >
            <Ionicons name="close-circle" size={40} color="#fff" />
          </TouchableOpacity>
          {selectedLogImage && (
            <Image
              source={{ uri: selectedLogImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Create Log Modal */}
      <Modal
        visible={createLogModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateLogModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.createLogModalContent]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Log Entry</Text>
              <TouchableOpacity onPress={() => setCreateLogModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.createLogScrollView}>
              {/* Title Input */}
              <Text style={styles.inputLabel}>Title</Text>
              <TextInput
                style={styles.logInput}
                placeholder="Enter log title"
                placeholderTextColor="#64748b"
                value={newLogTitle}
                onChangeText={setNewLogTitle}
              />

              {/* Description Input */}
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={[styles.logInput, styles.logTextArea]}
                placeholder="Describe the activity or incident..."
                placeholderTextColor="#64748b"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={newLogDescription}
                onChangeText={setNewLogDescription}
              />

              {/* Category Selection */}
              <Text style={styles.inputLabel}>Category</Text>
              <View style={styles.categoryGrid}>
                {LOG_CATEGORIES.map((category) => (
                  <TouchableOpacity
                    key={category.value}
                    style={[
                      styles.categoryButton,
                      newLogCategory === category.value && { backgroundColor: category.color },
                    ]}
                    onPress={() => setNewLogCategory(category.value as any)}
                  >
                    <Ionicons 
                      name={category.icon as any} 
                      size={20} 
                      color={newLogCategory === category.value ? '#fff' : category.color} 
                    />
                    <Text style={[
                      styles.categoryButtonText,
                      newLogCategory === category.value && styles.categoryButtonTextSelected,
                    ]}>
                      {category.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Image Attachment Section */}
              <Text style={styles.inputLabel}>Attachments (Optional)</Text>
              <View style={styles.imageButtonsContainer}>
                <TouchableOpacity 
                  style={styles.imagePickerButton}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={24} color="#2563eb" />
                  <Text style={styles.imagePickerText}>Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.imagePickerButton}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={24} color="#2563eb" />
                  <Text style={styles.imagePickerText}>Choose Image</Text>
                </TouchableOpacity>
              </View>

              {/* Selected Images Preview */}
              {selectedImages.length > 0 && (
                <View style={styles.selectedImagesContainer}>
                  <Text style={styles.selectedImagesLabel}>
                    {selectedImages.length} image(s) selected
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {selectedImages.map((uri, index) => (
                      <View key={index} style={styles.imagePreviewContainer}>
                        <Image
                          source={{ uri }}
                          style={styles.imagePreview}
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons name="close-circle" size={24} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </ScrollView>

            {/* Submit Button */}
            <View style={styles.createLogFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setCreateLogModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalSubmit]}
                onPress={createLog}
                disabled={isSubmittingLog}
              >
                {isSubmittingLog ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>Save Log</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerLeft: {
    flexDirection: 'column',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  headerLogoutButton: {
    padding: 8,
    borderRadius: 8,
  },
  content: {
    flex: 1,
  },
  tabContent: {
    flex: 1,
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    marginTop: 8,
  },
  
  // Patrol Tab Styles
  recordingStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  recordingIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#64748b',
    marginRight: 8,
  },
  recordingActive: {
    backgroundColor: '#ef4444',
  },
  recordingStatusText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  timerContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  timerText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
  },
  statusMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 8,
  },
  statusMessageText: {
    color: '#22c55e',
    fontSize: 14,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 12,
  },
  stopButton: {
    backgroundColor: '#dc2626',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  checkpointGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  checkpointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    width: '47%',
  },
  checkpointActive: {
    backgroundColor: '#2563eb',
  },
  checkpointText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  checkpointTextDisabled: {
    color: '#64748b',
  },
  historyContainer: {
    gap: 12,
    marginBottom: 56,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  historyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyInfo: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  historySubtitle: {
    color: '#64748b',
    fontSize: 14,
  },
  historyDuration: {
    alignItems: 'flex-end',
  },
  historyDurationText: {
    color: '#2563eb',
    fontSize: 18,
    fontWeight: 'bold',
  },
  historyLabel: {
    color: '#64748b',
    fontSize: 12,
  },
  historyLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 10,
  },
  historyLoadingText: {
    color: '#64748b',
    fontSize: 14,
  },
  historyEmptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 12,
  },
  historyEmptyText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  historyEmptySubtext: {
    color: '#64748b',
    fontSize: 14,
  },
  
  // Details Tab Styles
  guardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },
  guardInfo: {
    flex: 1,
    marginLeft: 16,
  },
  guardName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  guardId: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 4,
  },
  editButton: {
    padding: 8,
  },
  timeRow: {
    flexDirection: 'row',
    gap: 16,
  },
  timeItem: {
    flex: 1,
  },
  timeLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  timeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationLabel: {
    color: '#fff',
    fontSize: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 12,
    fontSize: 16,
  },
  areasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 42,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  areaItemSelected: {
    backgroundColor: '#2563eb',
  },
  areaItemDisabled: {
    opacity: 0.5,
  },
  areaText: {
    color: '#fff',
    fontSize: 14,
  },
  areaTextSelected: {
    color: '#fff',
  },
  saveButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 26,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Bottom Tab Bar Styles
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingVertical: 8,
    paddingBottom: 35,
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  bottomTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '500',
  },
  bottomTabActive: {
    color: '#2563eb',
  },
  
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 24,
    width: '80%',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  pickerModalContent: {
    width: '85%',
    maxHeight: '60%',
    padding: 0,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  pickerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  pickerList: {
    maxHeight: 350,
    padding: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 4,
  },
  pickerItemSelected: {
    backgroundColor: '#2563eb',
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  pickerItemText: {
    color: '#fff',
    fontSize: 16,
  },
  pickerItemTextSelected: {
    fontWeight: '600',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#2563eb',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  modalInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: '#1e293b',
  },
  modalSubmit: {
    backgroundColor: '#2563eb',
  },
  modalCancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalSubmitText: {
    color: '#fff',
    fontWeight: '600',
  },
  
  // Loading screen styles
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0f172a',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 16,
    marginTop: 16,
  },

  // Map styles
  mapContainer: {
    height: 200,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  map: {
    flex: 1,
  },
  
  // Settings Tab Styles
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 24,
    marginBottom: 24,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 12,
    gap: 8,
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 16,
    fontWeight: '600',
  },

  // Logs Tab Styles
  logsStatsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  logsStatCard: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logsStatNumber: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  logsStatLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'center',
  },
  logsContainer: {
    gap: 12,
    marginBottom: 80,
  },
  logsCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  logsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logsInfo: {
    flex: 1,
    marginLeft: 12,
  },
  logsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logsDate: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  logsCategoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  logsCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  logsDescription: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  logsImagesContainer: {
    marginTop: 12,
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 12,
  },
  logsImagesScroll: {
    marginTop: 4,
  },
  logsImageThumbnail: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
    marginRight: 8,
  },
  logsImagesIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  logsImagesText: {
    color: '#64748b',
    fontSize: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },

  // Create Log Modal Styles
  createLogModalContent: {
    width: '90%',
    maxHeight: '80%',
    padding: 0,
    overflow: 'hidden',
  },
  createLogScrollView: {
    padding: 16,
    maxHeight: 400,
  },
  inputLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  logInput: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 16,
  },
  logTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: '#374151',
  },
  categoryButtonText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '500',
  },
  categoryButtonTextSelected: {
    color: '#fff',
  },
  imageNoteContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 10,
    marginTop: 20,
    gap: 8,
  },
  imageNoteText: {
    color: '#64748b',
    fontSize: 14,
  },
  imageButtonsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  imagePickerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  imagePickerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  selectedImagesContainer: {
    marginTop: 16,
  },
  selectedImagesLabel: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 10,
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    backgroundColor: '#1e293b',
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 8,
    objectFit: 'cover',
    borderWidth: 1,
    borderColor: '#2563eb',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  createLogFooter: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    gap: 12,
  },

  // Image Viewer Modal Styles
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  imageViewerImage: {
    width: '90%',
    height: '80%',
  },
});
