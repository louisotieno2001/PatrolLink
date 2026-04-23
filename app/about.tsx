import { Text, StyleSheet, ScrollView } from 'react-native';

export default function AboutScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>About PatrolLink</Text>

      <Text style={styles.text}>
        PatrolLink is a smart guard tracking and monitoring platform designed for
        modern security operations. It enables security companies to monitor
        guards in real time, record patrol routes, and maintain accurate,
        time-stamped movement logs for accountability and reporting.
      </Text>

      <Text style={styles.subtitle}>What PatrolLink Does</Text>
      <Text style={styles.text}>
        • Tracks guards’ live GPS locations during active shifts{'\n'}
        • Records patrol trails with precise timestamps{'\n'}
        • Provides supervisors with real-time visibility and alerts{'\n'}
        • Stores historical patrol data for audits and investigations{'\n'}
        • Enhances transparency and trust between guards, clients, and companies
      </Text>

      <Text style={styles.subtitle}>Why PatrolLink Matters</Text>
      <Text style={styles.text}>
        Traditional patrol supervision relies heavily on manual reporting,
        which is prone to delays and inaccuracies. PatrolLink eliminates guesswork
        by providing verifiable, location-based patrol data. This ensures guards
        are where they are supposed to be — when they are supposed to be there.
      </Text>

      <Text style={styles.subtitle}>Built for Security Teams</Text>
      <Text style={styles.text}>
        PatrolLink is built with security companies, supervisors, and guards in
        mind. The system is lightweight, reliable, and designed to work in
        real-world conditions with minimal user interaction.
      </Text>

      <Text style={styles.subtitle}>Privacy & Trust</Text>
      <Text style={styles.text}>
        We take privacy seriously. Location tracking is active only during
        authorized duty hours, and all data is securely stored and accessible
        only to approved personnel.
      </Text>

      <Text style={styles.footer}>
        PatrolLink — Every Step Accounted For.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    color: '#4fa3ff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 6,
  },
  text: {
    color: '#ddd',
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 30,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});