import React from 'react';
import {  ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function PrivacyPolicyScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Privacy Policy</Text>
        <Text style={styles.updated}>Last updated: February 27, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          <Text style={styles.body}>
            PatrolLink collects account details such as name, phone number, role, and organization
            invite code. When guards are on patrol, location data and patrol activity may be recorded.
            Log entries may also include notes and optional images uploaded by users.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. How We Use Information</Text>
          <Text style={styles.body}>
            We use collected data to authenticate users, assign guards, monitor patrol activity,
            support incident reporting, and improve service reliability and security.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Data Sharing</Text>
          <Text style={styles.body}>
            Data is shared only with authorized users within your organization and service providers
            needed to operate PatrolLink. We do not sell personal data to third parties.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data Retention</Text>
          <Text style={styles.body}>
            Account, assignment, patrol, and log data are retained while your organization uses the
            platform, or as required by legal and operational needs. Organizations can request data
            deletion where applicable.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Security</Text>
          <Text style={styles.body}>
            We apply reasonable technical and administrative safeguards to protect data. No storage or
            transmission system can be guaranteed as fully secure.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.body}>
            You may request access, correction, or deletion of your personal information through your
            organization administrator or support channels, subject to applicable law.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Contact</Text>
          <Text style={styles.body}>
            For privacy questions or requests, contact your administrator or PatrolLink support.
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
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  updated: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 16,
  },
  section: {
    marginBottom: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    padding: 14,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
  },
});
