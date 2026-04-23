import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserSession } from './services/auth.storage';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

interface LocationData {
  id: string;
  name: string;
  assigned_areas?: string;
}

export default function LocationsScreen() {
  const router = useRouter();
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<LocationData | null>(null);
  const [editName, setEditName] = useState('');
  const [editAreas, setEditAreas] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const getAuthToken = async () => {
    const { token } = await getUserSession();
    if (!token) {
      throw new Error('Session expired');
    }
    return token;
  };

  const fetchLocations = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/locations`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to fetch locations');
      }

      const data = await response.json();
      setLocations(data.locations || []);
    } catch (err: any) {
      const message = err?.message || 'Failed to fetch locations';
      setError(message);
      if (message.includes('Session expired')) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => router.replace('/login') },
        ]);
      }
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchLocations();
    }, [fetchLocations])
  );

  const openEditModal = (location: LocationData) => {
    setSelectedLocation(location);
    setEditName(location.name || '');
    setEditAreas(location.assigned_areas || '');
    setIsEditVisible(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedLocation) return;

    const name = editName.trim();
    if (!name) {
      Alert.alert('Validation Error', 'Location name is required.');
      return;
    }

    try {
      setIsSaving(true);
      const token = await getAuthToken();
      const response = await fetch(`${API_URL}/admin/locations/${selectedLocation.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          assigned_areas: editAreas.trim(),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to update location');
      }

      setIsEditVisible(false);
      setSelectedLocation(null);
      await fetchLocations(true);
      Alert.alert('Success', 'Location updated successfully.');
    } catch (err: any) {
      Alert.alert('Update Failed', err?.message || 'Failed to update location.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (location: LocationData) => {
    Alert.alert(
      'Delete Location',
      `Are you sure you want to delete "${location.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(location.id);
              const token = await getAuthToken();
              const response = await fetch(`${API_URL}/admin/locations/${location.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to delete location');
              }

              await fetchLocations(true);
              Alert.alert('Success', 'Location deleted successfully.');
            } catch (err: any) {
              Alert.alert('Delete Failed', err?.message || 'Failed to delete location.');
            } finally {
              setDeletingId('');
            }
          },
        },
      ]
    );
  };

  const renderLocation = ({ item }: { item: LocationData }) => (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.cardHeaderLeft}>
          <Ionicons name="location" size={20} color="#2563eb" />
          <Text style={styles.locationName}>{item.name}</Text>
        </View>
      </View>
      <Text style={styles.locationAreas}>
        Areas: {item.assigned_areas?.trim() ? item.assigned_areas : 'No areas assigned'}
      </Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.editBtn} onPress={() => openEditModal(item)}>
          <Ionicons name="create-outline" size={16} color="#fff" />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteBtn, deletingId === item.id && styles.disabledBtn]}
          onPress={() => handleDelete(item)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="trash-outline" size={16} color="#fff" />
              <Text style={styles.actionText}>Delete</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Locations</Text>
          <Text style={styles.subtitle}>Manage organization locations</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/add_locations')}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.addBtnText}>Add New</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.helperText}>Loading locations...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchLocations()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={locations}
          keyExtractor={(item) => item.id}
          renderItem={renderLocation}
          contentContainerStyle={locations.length === 0 ? styles.centeredList : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchLocations(true)} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="location-outline" size={40} color="#94a3b8" />
              <Text style={styles.helperText}>No locations found.</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={isEditVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Location</Text>

            <Text style={styles.inputLabel}>Location Name</Text>
            <TextInput
              style={styles.input}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter location name"
              placeholderTextColor="#64748b"
            />

            <Text style={styles.inputLabel}>Assigned Areas</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={editAreas}
              onChangeText={setEditAreas}
              placeholder="Comma-separated areas"
              placeholderTextColor="#64748b"
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, isSaving && styles.disabledBtn]}
                onPress={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.saveText}>Save</Text>
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
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
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
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 24,
  },
  centeredList: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    flexShrink: 1,
  },
  locationAreas: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  helperText: {
    color: '#94a3b8',
    marginTop: 10,
    fontSize: 14,
  },
  errorText: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 12,
  },
  retryBtn: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    borderTopWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  inputLabel: {
    color: '#cbd5e1',
    marginBottom: 6,
    marginTop: 6,
    fontSize: 13,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  saveText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
