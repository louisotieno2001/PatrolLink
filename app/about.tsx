import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Text, StyleSheet, ScrollView, View, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AboutScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>About PatrolLink</Text>
          <Text style={styles.headerSubtitle}>Every step accounted for</Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.text}>
          PatrolLink is a smart guard tracking and monitoring platform designed for
          modern security operations. It enables security companies to monitor
          guards in real time, record patrol routes, and maintain accurate,
          time-stamped movement logs for accountability and reporting.
        </Text>

        <Text style={styles.sectionTitle}>What PatrolLink Does</Text>
        <Text style={styles.text}>
          • Tracks guards’ live GPS locations during active shifts{'\n'}
          • Records patrol trails with precise timestamps{'\n'}
          • Provides supervisors with real-time visibility and alerts{'\n'}
          • Stores historical patrol data for audits and investigations{'\n'}
          • Enhances transparency and trust between guards, clients, and companies
        </Text>

        <Text style={styles.sectionTitle}>Why PatrolLink Matters</Text>
        <Text style={styles.text}>
          Traditional patrol supervision relies heavily on manual reporting,
          which is prone to delays and inaccuracies. PatrolLink eliminates guesswork
          by providing verifiable, location-based patrol data. This ensures guards
          are where they are supposed to be — when they are supposed to be there.
        </Text>

        <Text style={styles.sectionTitle}>Built for Security Teams</Text>
        <Text style={styles.text}>
          PatrolLink is built with security companies, supervisors, and guards in
          mind. The system is lightweight, reliable, and designed to work in
          real-world conditions with minimal user interaction.
        </Text>

        <Text style={styles.sectionTitle}>Privacy & Trust</Text>
        <Text style={styles.text}>
          We take privacy seriously. Location tracking is active only during
          authorized duty hours, and all data is securely stored and accessible
          only to approved personnel.
        </Text>

        <View style={styles.footerContainer}>
          <Text style={styles.footer}>
            PatrolLink — Every Step Accounted For.
          </Text>
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
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#4fa3ff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 24,
    marginBottom: 8,
  },
  text: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 24,
  },
  footerContainer: {
    marginTop: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  footer: {
    color: '#64748b',
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
