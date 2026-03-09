import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function TermsOfServiceScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Terms of Service</Text>
        <Text style={styles.updated}>Last updated: February 27, 2026</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.body}>
            By using OmniWatch, you agree to these Terms of Service. If you do not agree, do not use
            the application or related services.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>2. Use of Service</Text>
          <Text style={styles.body}>
            OmniWatch is intended for organizational security operations. Users must provide accurate
            account information and use the service only for lawful, authorized purposes.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>3. Account Responsibilities</Text>
          <Text style={styles.body}>
            You are responsible for maintaining account confidentiality and for all activity under your
            account. Notify your administrator immediately if you suspect unauthorized access.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>4. Data and Content</Text>
          <Text style={styles.body}>
            Patrol records, logs, and uploaded content are managed by your organization through
            OmniWatch. You confirm that any content you submit is lawful and does not violate rights.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>5. Service Availability</Text>
          <Text style={styles.body}>
            We aim to keep services available and reliable, but OmniWatch may be interrupted for
            maintenance, security updates, or technical issues.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
          <Text style={styles.body}>
            To the extent permitted by law, OmniWatch is provided “as is” without warranties. We are
            not liable for indirect or consequential damages arising from service use.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>7. Changes to Terms</Text>
          <Text style={styles.body}>
            We may update these terms from time to time. Continued use after updates means you accept
            the revised terms.
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
