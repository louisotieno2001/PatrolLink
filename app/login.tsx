import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ActivityIndicator,
} from 'react-native';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import Constants from 'expo-constants';
import { saveUserSession } from './services/auth.storage';
import CustomToast, { type ToastType } from '@/components/CustomToast';
const API_URL = Constants.expoConfig?.extra?.apiUrl;

export default function LoginScreen() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('KE'); // default Kenya
  const [callingCode, setCallingCode] = useState('254');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<{ visible: boolean; message: string; type: ToastType }>({
    visible: false,
    message: '',
    type: 'success',
  });
  const showToast = (message: string, type: ToastType) => {
    setToast({ visible: true, message, type });
  };

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  const handleLogin = async () => {
    // Reset errors
    setPhoneError('');
    setPasswordError('');

    // Validation
    if (!phoneNumber || !password) {
      if (!phoneNumber) setPhoneError('Phone number is required');
      if (!password) setPasswordError('Password is required');
      return;
    }

    // Phone number validation: digits only, 7-15 digits
    const phoneRegex = /^\d{7,15}$/;
    if (!phoneRegex.test(phoneNumber)) {
      setPhoneError('Phone number must be 7-15 digits long and contain only numbers');
      return;
    }

    // Password validation: at least 8 characters, with uppercase, lowercase, digit, special character
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      setPasswordError('Password must be at least 8 characters long and include at least one uppercase letter, one lowercase letter, one digit, and one special character (@$!%*?&)');
      return;
    }

    setIsLoading(true);

    try {
      const fullPhone = `+${callingCode}${phoneNumber}`;

      // console.log('Logging in with:', { phone: fullPhone });

      // Call backend API
      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: fullPhone,
          password: password,
        }),
      });

      const data = await response.json();
      // console.log('Login response data:', data); 

      if (response.ok) {
        // Store the JWT token using AsyncStorage
        await saveUserSession(data.token, data.user);

        if (data?.user?.role === 'guard' && data?.patrol_status === 'logged_out_on_patrol') {
          showToast(
            'Patrol Ongoing. Your previous patrol was never ended. Patrol tracking will resume after login.', 'success'
          );
        }

        // console.log('Login successful, user:', data.user);

        // Role-based redirection
        const userRole = data.user?.role;
        // console.log('User role:', userRole);

        switch (userRole) {
          case 'admin':
          case 'supervisor':
            // console.log('Redirecting to admin dashboard...');
            router.replace('/admin_dash');
            break;
          case 'guard':
            // console.log('Redirecting to guard dashboard...');
            router.replace('/guard_dash');
            break;
          default:
            // console.log('Unknown or missing role, redirecting to a default screen...');
            // Fallback for other roles or if role is not defined
            // For now, let's alert the user and stay on the login screen
            showToast( 
              `Login Successful, But..., Your role ${userRole} does not have a designated dashboard. Please contact support.`, 'error'
            );
            break;
        }
      } else {
        showToast('Login Failed', data.message || 'Invalid phone number or password');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      showToast(`Connection Error, Unable to connect to the server at ${API_URL}. Please check your internet connection and try again.`, 'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.formContainer, isLargeScreen && styles.formContainerLarge]}>
        <Text style={styles.title}>Welcome Back to OmniWatch</Text>
        <Text style={styles.subtitle}>Login with your phone number</Text>

        {/* Phone Number Input with Country Picker */}
        <View style={styles.phoneContainer}>
          <CountryPicker
            countryCode={countryCode}
            withCallingCode
            withFlag
            withFilter
            withEmoji
            onSelect={(country: any) => {
              setCountryCode(country.cca2);
              setCallingCode(country.callingCode[0]);
            }}
            containerButtonStyle={{ marginRight: 10 }}
          />
          <Text style={styles.callingCode}>+{callingCode}</Text>
          <TextInput
            placeholder="Phone Number *"
            placeholderTextColor="#94a3b8"
            keyboardType="phone-pad"
            style={styles.phoneInput}
            value={phoneNumber}
            onChangeText={(text) => {
              setPhoneNumber(text);
              setPhoneError('');
            }}
          />
        </View>
        {phoneError ? <Text style={styles.errorText}>{phoneError}</Text> : null}

        {/* Password Input */}
        <View style={styles.inputContainer}>
          <Ionicons name="lock-closed" size={20} color="#94a3b8" />
          <TextInput
            placeholder="Password *"
            placeholderTextColor="#94a3b8"
            secureTextEntry={!showPassword}
            style={styles.input}
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              setPasswordError('');
            }}
          />
          <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
            <Ionicons
              name={showPassword ? 'eye-off' : 'eye'}
              size={20}
              color="#94a3b8"
            />
          </TouchableOpacity>
        </View>
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        {/* Login Button */}
        <TouchableOpacity
          style={[styles.button, isLoading && styles.buttonDisabled]}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        {/* Forgot Password */}
        <TouchableOpacity style={{ marginTop: 16 }}>
          <Text style={styles.link}>Forgot Password?</Text>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <TouchableOpacity>
            <Text style={styles.link} onPress={() => router.push('/signup')}> Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
      <CustomToast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  formContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  formContainerLarge: {
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    color: '#94a3b8',
    marginBottom: 20,
    textAlign: 'center',
  },
  phoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    marginBottom: 16,
    height: 60,
  },
  phoneInput: {
    flex: 1,
    color: '#fff',
    paddingVertical: 14,
  },
  callingCode: {
    color: '#fff',
    marginRight: 10,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 14,
    marginLeft: 10,
  },
  button: {
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#1e40af',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  link: {
    color: '#4fa3ff',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    color: '#94a3b8',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
    marginLeft: 14,
  },
});
