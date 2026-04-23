import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getUserSession } from './services/auth.storage';
import {
  getPhonePermissionStatus,
  requestPhonePermission,
} from './utils/permissions';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

interface Guard {
  id: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  location?: string;
  assigned_areas?: string;
}

export default function ManageGuardsScreen() {
  const router = useRouter();
  const [guards, setGuards] = useState<Guard[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [removingId, setRemovingId] = useState('');
  const [phonePermission, setPhonePermission] = useState<boolean | null>(null);

  const getToken = async () => {
    const { token } = await getUserSession();
    if (!token) {
      throw new Error('Session expired');
    }
    return token;
  };

  const fetchGuards = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setError('');

      const token = await getToken();
      const response = await fetch(`${API_URL}/admin/guards`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to load guards');
      }

      const data = await response.json();
      setGuards(data.guards || []);
    } catch (err: any) {
      const message = err?.message || 'Failed to load guards';
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
      fetchGuards();
    }, [fetchGuards])
  );

  const filteredGuards = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return guards;

    return guards.filter((guard) => {
      const name = `${guard.first_name || ''} ${guard.last_name || ''}`.trim().toLowerCase();
      const phone = (guard.phone || '').toLowerCase();
      const location = (guard.location || '').toLowerCase();
      return name.includes(query) || phone.includes(query) || location.includes(query);
    });
  }, [guards, search]);

  const handleCall = async (phone?: string) => {
    if (!phone || !phone.trim()) {
      Alert.alert('No Phone Number', 'This guard does not have a phone number.');
      return;
    }

    if (Platform.OS === 'android') {
      if (phonePermission === null) {
        const status = await getPhonePermissionStatus();
        setPhonePermission(status);
        if (!status) {
          const granted = await requestPhonePermission();
          setPhonePermission(granted);
          if (!granted) return;
        }
      } else if (!phonePermission) {
        const granted = await requestPhonePermission();
        setPhonePermission(granted);
        if (!granted) return;
      }
    }

    const url = `tel:${phone}`;
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) {
      Alert.alert('Call Failed', 'Calling is not supported on this device.');
      return;
    }

    Linking.openURL(url);
  };

  const handleRemoveGuard = (guard: Guard) => {
    const fullName = `${guard.first_name || ''} ${guard.last_name || ''}`.trim() || 'this guard';
    Alert.alert(
      'Remove Guard',
      `Remove ${fullName} from your organization? This will also delete related assignments and logs.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              setRemovingId(guard.id);
              const token = await getToken();
              const response = await fetch(`${API_URL}/admin/guards/${guard.id}`, {
                method: 'DELETE',
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              });

              if (!response.ok) {
                const message = await response.text();
                throw new Error(message || 'Failed to remove guard');
              }

              await fetchGuards(true);
              Alert.alert('Success', 'Guard removed successfully.');
            } catch (err: any) {
              Alert.alert('Remove Failed', err?.message || 'Failed to remove guard.');
            } finally {
              setRemovingId('');
            }
          },
        },
      ]
    );
  };

  const handleAssign = (guard: Guard) => {
    const fullName = `${guard.first_name || ''} ${guard.last_name || ''}`.trim();
    router.push({
      pathname: '/new_assignment',
      params: {
        guardId: guard.id,
        guardName: fullName,
      },
    } as any);
  };

  const renderGuardCard = ({ item }: { item: Guard }) => {
    const fullName = `${item.first_name || ''} ${item.last_name || ''}`.trim() || 'Unknown Guard';
    const areas = item.assigned_areas?.trim() ? item.assigned_areas : 'No assigned areas';

    return (
      <View style={styles.card}>
        <View style={styles.rowTop}>
          <View style={styles.guardInfo}>
            <Text style={styles.guardName}>{fullName}</Text>
            <Text style={styles.guardMeta}>{item.phone || 'No phone number'}</Text>
            <Text style={styles.guardMeta}>Location: {item.location || 'Not assigned'}</Text>
            <Text style={styles.guardMeta}>Areas: {areas}</Text>
          </View>
          <TouchableOpacity style={styles.callButton} onPress={() => handleCall(item.phone)}>
            <Ionicons name="call" size={18} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.assignBtn} onPress={() => handleAssign(item)}>
            <Ionicons name="location-outline" size={16} color="#fff" />
            <Text style={styles.actionText}>Assign</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.removeBtn, removingId === item.id && styles.disabled]}
            onPress={() => handleRemoveGuard(item)}
            disabled={removingId === item.id}
          >
            {removingId === item.id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={16} color="#fff" />
                <Text style={styles.actionText}>Remove</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Guards</Text>
        <Text style={styles.subtitle}>Search, call, assign, and remove guards</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color="#94a3b8" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name, phone, or location"
          placeholderTextColor="#64748b"
          style={styles.searchInput}
        />
      </View>

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.helper}>Loading guards...</Text>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Text style={styles.error}>{error}</Text>
          <TouchableOpacity style={styles.retry} onPress={() => fetchGuards()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredGuards}
          keyExtractor={(item) => item.id}
          renderItem={renderGuardCard}
          contentContainerStyle={filteredGuards.length ? styles.list : styles.emptyList}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => fetchGuards(true)} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={38} color="#94a3b8" />
              <Text style={styles.helper}>No guards found.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 2,
  },
  searchWrap: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    marginBottom: 12,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  guardInfo: {
    flex: 1,
  },
  guardName: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  guardMeta: {
    color: '#cbd5e1',
    fontSize: 13,
    marginBottom: 2,
  },
  callButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 8,
  },
  assignBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  removeBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  actionText: {
    color: '#fff',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  helper: {
    color: '#94a3b8',
    marginTop: 10,
  },
  error: {
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 10,
  },
  retry: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.7,
  },
});
