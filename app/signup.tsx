import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CountryPicker, { CountryCode } from 'react-native-country-picker-modal';
import Constants from 'expo-constants';
const API_URL = Constants.expoConfig?.extra?.apiUrl;

export default function SignupScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countryCode, setCountryCode] = useState<CountryCode>('KE'); // default Kenya
  const [callingCode, setCallingCode] = useState('254');
  const [role, setRole] = useState('guard');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [companyCode, setCompanyCode] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [inviteCodeError, setInviteCodeError] = useState('');
  const [isInviteCodeValid, setIsInviteCodeValid] = useState<boolean | null>(null);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [generalError, setGeneralError] = useState('');

  const router = useRouter();
  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768;

  // Validate invite code
  const validateInviteCode = async (code: string): Promise<boolean> => {
    setIsValidatingCode(true);
    setInviteCodeError('');
    setIsInviteCodeValid(null);

    try {
      const response = await fetch(`${API_URL}/organizations/validate-invite-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteCode: code }),
      });

      const data = await response.json();

      if (response.ok && data.valid) {
        setIsInviteCodeValid(true);
        return true;
      } else {
        setInviteCodeError(data.message || 'Invalid invite code');
        setIsInviteCodeValid(false);
        return false;
      }
    } catch (error) {
      console.error('Invite code validation error:', error);
      setInviteCodeError('Failed to validate invite code. Please check your connection.');
      setIsInviteCodeValid(false);
      return false;
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSignup = async () => {
    // Reset errors and messages
    setFirstNameError('');
    setLastNameError('');
    setPhoneError('');
    setPasswordError('');
    setSuccessMessage('');
    setGeneralError('');

    // Validation
    if (!firstName || !lastName || !phoneNumber || !password) {
      setGeneralError('Please fill in all required fields');
      return;
    }

    // Name validation: at least 2 letters
    const nameRegex = /^[a-zA-Z]{2,}$/;
    if (!nameRegex.test(firstName.trim())) {
      setFirstNameError('First name must be at least 2 letters long and contain only letters');
      return;
    }
    if (!nameRegex.test(lastName.trim())) {
      setLastNameError('Last name must be at least 2 letters long and contain only letters');
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

    // Validate invite code if provided
    if (companyCode.trim() !== '') {
      const isValid = await validateInviteCode(companyCode.trim());
      if (!isValid) {
        return; // validateInviteCode already shows the error
      }
    }

    setIsLoading(true);

    try {
      // Combine country calling code + phone
      const fullPhone = `+${callingCode}${phoneNumber}`;

      // Call backend API
      const response = await fetch(`${API_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone: fullPhone,
          password,
          role,
          companyCode,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccessMessage('Account created successfully! Redirecting to login...');
        // Clear form
        setFirstName('');
        setLastName('');
        setPhoneNumber('');
        setPassword('');
        setCompanyCode('');
        setInviteCodeError('');
        setIsInviteCodeValid(null);
        
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push('/login');
        }, 2000);
      } else {
        setGeneralError(data.message || 'Something went wrong. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setGeneralError('Unable to connect to the server. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.scrollContent, isLargeScreen && styles.scrollContentLarge]}>
        <View style={[styles.formWrapper, isLargeScreen && styles.formWrapperLarge]}>
          <Text style={styles.title}>Create PatrolLink Account</Text>

          {/* First Name */}
          <Input 
            icon="person" 
            placeholder="First Name *" 
            value={firstName} 
            onChangeText={(text) => {
              setFirstName(text);
              setFirstNameError('');
            }}
            error={firstNameError}
          />

          {/* Last Name */}
          <Input 
            icon="person" 
            placeholder="Last Name *" 
            value={lastName} 
            onChangeText={(text) => {
              setLastName(text);
              setLastNameError('');
            }}
            error={lastNameError}
          />

          {/* Phone Number with Country Picker */}
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

          {/* Role */}
          <View style={styles.inputContainer}>
            <Ionicons name="briefcase" size={20} color="#94a3b8" />
            <Picker
              selectedValue={role}
              onValueChange={(value) => setRole(value)}
              style={{ color: '#fff', flex: 1 }}
              dropdownIconColor="#fff"
            >
              <Picker.Item label="Guard" value="guard" />
              <Picker.Item label="Supervisor" value="supervisor" />
            </Picker>
          </View>

          {/* Company / Invite Code */}
          <View>
            <View style={styles.inputContainer}>
              <Ionicons name="key" size={20} color="#94a3b8" />
              <TextInput
                placeholder="Company Code / Invite Code"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                value={companyCode}
                onChangeText={(text) => {
                  setCompanyCode(text);
                  setInviteCodeError('');
                  setIsInviteCodeValid(null);
                  // Reset validation state when text changes
                }}
                onBlur={() => {
                  // Validate on blur if code is not empty
                  if (companyCode.trim() !== '') {
                    validateInviteCode(companyCode.trim());
                  }
                }}
              />
              {isValidatingCode ? (
                <ActivityIndicator size="small" color="#2563eb" />
              ) : isInviteCodeValid ? (
                <Ionicons name="checkmark-circle" size={22} color="#22c55e" />
              ) : isInviteCodeValid === false ? (
                <Ionicons name="close-circle" size={22} color="#ef4444" />
              ) : null}
            </View>
            {inviteCodeError ? <Text style={styles.errorText}>{inviteCodeError}</Text> : null}
          </View>

          {/* Password */}
          <View style={styles.inputContainer}>
            <Ionicons name="lock-closed" size={20} color="#94a3b8" />
            <TextInput
              placeholder="Password *"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!passwordVisible}
              style={styles.input}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setPasswordError('');
              }}
            />
            <TouchableOpacity onPress={() => setPasswordVisible(!passwordVisible)}>
              <Ionicons name={passwordVisible ? "eye-off" : "eye"} size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

          {/* Signup Button */}
          <TouchableOpacity 
            style={[styles.button, isLoading && styles.buttonDisabled]} 
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign Up</Text>
            )}
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <TouchableOpacity>
              <Text style={styles.link} onPress={() => router.push('/login')}> Login</Text>
            </TouchableOpacity>
          </View>

          {/* Success Message */}
          {successMessage ? (
            <View style={styles.successMessageContainer}>
              <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
              <Text style={styles.successMessageText}>{successMessage}</Text>
            </View>
          ) : null}

          {/* Error Message */}
          {generalError ? (
            <View style={styles.errorMessageContainer}>
              <Ionicons name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.errorMessageText}>{generalError}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Reusable Input Component */
function Input({ icon, placeholder, secure = false, value, onChangeText, error } : { icon: string; placeholder: string; secure?: boolean; value: string; onChangeText: (text: string) => void; error?: string }) {
  return (
    <View>
      <View style={styles.inputContainer}>
        <Ionicons name={icon as any} size={20} color="#94a3b8" />
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#94a3b8"
          secureTextEntry={secure}
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
        />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  scrollContentLarge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  formWrapper: {
    padding: 24,
  },
  formWrapperLarge: {
    maxWidth: 480,
    width: '100%',
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    textAlign: 'center',
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
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 24,
  },
  footerText: {
    color: '#94a3b8',
  },
  link: {
    color: '#4fa3ff',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 0,
    marginLeft: 14,
    marginBottom:14,
  },
  successMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderWidth: 1,
    borderColor: '#22c55e',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
  },
  successMessageText: {
    color: '#22c55e',
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
  errorMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
  },
  errorMessageText: {
    color: '#ef4444',
    marginLeft: 10,
    fontSize: 14,
    flex: 1,
  },
});

