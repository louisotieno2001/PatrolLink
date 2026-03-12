import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function Header() {
  const [menuVisible, setMenuVisible] = useState(false);
  const router = useRouter();

  const menuItems: { title: string; icon: string; screen: '/about' | '/settings' | '/support' | '/privacy_policy' | '/terms_of_service', }[] = [
    { title: 'About', icon: 'information-circle', screen: '/about' },
    { title: 'Settings', icon: 'settings', screen: '/settings' },
    { title: 'Help & Support', icon: 'help-circle', screen: '/support'},
    { title: 'Privacy Policy', icon: 'document-text', screen: '/privacy_policy' },
    { title: 'Terms of Service', icon: 'document', screen: '/terms_of_service' },
  ];

  const navigateTo = (screen: '/about' | '/settings' | '/support' | '/privacy_policy' | '/terms_of_service') => {
    setMenuVisible(false);
    router.push(screen as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>OmniWatch</Text>
        </View>
        
        <TouchableOpacity 
          style={styles.menuButton} 
          onPress={() => setMenuVisible(true)}
        >
          <Ionicons name="menu" size={28} color="#fff" />
        </TouchableOpacity>

        <Modal
          visible={menuVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMenuVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity 
              style={styles.modalBackdrop} 
              onPress={() => setMenuVisible(false)}
            />
            <View style={styles.menuContainer}>
              <View style={styles.menuHeader}>
                <Text style={styles.menuTitle}>Menu</Text>
                <TouchableOpacity onPress={() => setMenuVisible(false)}>
                  <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.menuItems}>
                {menuItems.map((item, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.menuItem}
                    onPress={() => navigateTo(item.screen)}
                  >
                    <Ionicons name={item.icon as any} size={22} color="#4fa3ff" />
                    <Text style={styles.menuItemText}>{item.title}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        header: () => <Header />,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="about" />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
      <Stack.Screen name="settings" />
      <Stack.Screen name="OTP" options={{headerShown: false}} />
      <Stack.Screen name="guard_dash" />
      <Stack.Screen name="admin_dash" />
      <Stack.Screen name="locations" />
      <Stack.Screen name="add_locations" />
      <Stack.Screen name="manage_guards" />
      <Stack.Screen name="new_assignment" />
      <Stack.Screen name="privacy_policy" />
      <Stack.Screen name="terms_of_service" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  safeArea: {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuButton: {
    padding: 8,
  },
  modalOverlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalBackdrop: {
    flex: 1,
  },
  menuContainer: {
    width: 280,
    backgroundColor: '#111827',
    height: '100%',
    borderLeftWidth: 1,
    borderLeftColor: '#1e293b',
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  menuTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuItems: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#1e293b',
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
});
