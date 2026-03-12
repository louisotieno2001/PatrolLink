import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScrollView style={styles.container}>
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.appName}>OmniWatch</Text>
        <Text style={styles.tagline}>Every Step Accounted For</Text>
      </View>

      {/* Features */}
      <Text style={styles.sectionTitle}>Core Features</Text>

      <View style={styles.featuresGrid}>
        <Feature
          icon="map-marker-path"
          title="Live Tracking"
          description="Monitor guard movements in real time during active shifts."
        />

        <Feature
          icon="clock-check"
          title="Time-Stamped Trails"
          description="Every patrol route is recorded with precise timestamps."
        />

        <Feature
          icon="alert-decagram"
          title="Instant Visibility"
          description="Supervisors stay informed with live updates and alerts."
        />

        <Feature
          icon="database-lock"
          title="Secure Records"
          description="Historical patrol data stored safely for audits and reports."
        />
      </View>

      {/* Call to Action */}
      <View style={styles.ctaCard}>
        <Text style={styles.ctaTitle}>Ready to Begin?</Text>
        <Text style={styles.ctaText}>
          Start monitoring patrols with confidence and transparency.
        </Text>

        <TouchableOpacity style={styles.ctaButton} onPress={() => router.push('/login')}>
          <Text style={styles.ctaButtonText}>Get Started</Text>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

/* Feature Component */
function Feature({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <View style={styles.featureCard}>
      <MaterialCommunityIcons name={icon as any} size={28} color="#4fa3ff" />
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureText}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // deep navy
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },

  /* Header */
  header: {
    marginTop: 6,
    marginBottom: 30,
  },
  appName: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },

  /* Hero */
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginTop: 12,
  },
  heroText: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },

  /* Sections */
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 14,
  },

  /* Features */
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  featureTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 10,
  },
  featureText: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },

  /* CTA */
  ctaCard: {
    backgroundColor: '#1e40af',
    borderRadius: 20,
    padding: 22,
    marginTop: 20,
    marginBottom: 100,
  },
  ctaTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ctaText: {
    color: '#dbeafe',
    fontSize: 14,
    marginVertical: 10,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: 'flex-start',
    gap: 8,
  },
  ctaButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
