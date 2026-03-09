import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CustomToast, { type ToastType } from '@/components/CustomToast';
import { getUserSession } from './services/auth.storage';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

export default function AddLocationsScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [assignedAreas, setAssignedAreas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    },
    []
  );

  const showToast = (message: string, type: ToastType) => {
    setToast({ visible: true, message, type });
  };

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('Location name is required.', 'error');
      return;
    }

    try {
      setIsSubmitting(true);
      const { token } = await getUserSession();

      if (!token) {
        showToast('Session expired. Please login again.', 'error');
        redirectTimeoutRef.current = setTimeout(() => router.replace('/login'), 1200);
        return;
      }

      const response = await fetch(`${API_URL}/admin/locations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          assigned_areas: assignedAreas.trim(),
        }),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || 'Failed to create location');
      }

      showToast('Location added successfully.', 'success');
      redirectTimeoutRef.current = setTimeout(() => router.replace('/locations'), 1200);
    } catch (error: any) {
      showToast(error?.message || 'Failed to create location.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.page}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Add New Location</Text>
          <Text style={styles.subtitle}>Create a location for your organization guards.</Text>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Location Name</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. University Of Nairobi"
              placeholderTextColor="#64748b"
              value={name}
              onChangeText={setName}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Assigned Areas</Text>
            <TextInput
              style={[styles.input, styles.multiline]}
              placeholder="e.g. Gate A, Parking Zone 1, Lobby"
              placeholderTextColor="#64748b"
              value={assignedAreas}
              onChangeText={setAssignedAreas}
              multiline
            />
            <Text style={styles.hint}>Use commas to separate multiple areas.</Text>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => router.back()}
              disabled={isSubmitting}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, isSubmitting && styles.disabledBtn]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.submitText}>Add Location</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
        <CustomToast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  page: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 18,
  },
  formGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#cbd5e1',
    marginBottom: 6,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    color: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  multiline: {
    minHeight: 90,
    textAlignVertical: 'top',
  },
  hint: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#2563eb',
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#fff',
    fontWeight: '600',
  },
  submitText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledBtn: {
    opacity: 0.7,
  },
});
