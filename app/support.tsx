import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

// Issue types for the form
const ISSUE_TYPES = [
  { value: 'bug', label: 'Report Bug', icon: 'bug', color: '#ef4444' },
  { value: 'account', label: 'Account Issue', icon: 'person', color: '#f59e0b' },
  { value: 'location', label: 'Location/GPS', icon: 'location', color: '#22c55e' },
  { value: 'patrol', label: 'Patrol Problem', icon: 'walk', color: '#2563eb' },
  { value: 'log', label: 'Log Entry Issue', icon: 'document-text', color: '#8b5cf6' },
  { value: 'other', label: 'Other', icon: 'ellipsis-horizontal', color: '#64748b' },
];

// FAQ data
const FAQS = [
  {
    question: 'How do I start a patrol?',
    answer: 'Go to the Patrol tab and tap the "Start Patrol" button. Make sure location permissions are enabled for accurate tracking.',
  },
  {
    question: 'Why is my location not updating?',
    answer: 'Check that you have granted location permissions in your device settings. Ensure you have a stable internet connection.',
  },
  {
    question: 'How do I add images to a log entry?',
    answer: 'When creating a log entry, use the "Take Photo" or "Choose Image" buttons to attach images from your camera or gallery.',
  },
  {
    question: 'What should I do if the app is running slowly?',
    answer: 'Try closing other apps running in the background. Ensure you have a stable internet connection. If the problem persists, restart the app.',
  },
  {
    question: 'How do I update my guard profile?',
    answer: 'Go to Settings > Profile Information to access your profile details. You can update your operating hours, assignment location, and assigned areas.',
  },
  {
    question: 'Why am I not receiving notifications?',
    answer: 'Check your device notification settings and ensure the PatrolLink app has permission to send notifications.',
  },
  {
    question: 'How do I end my patrol correctly?',
    answer: 'Tap the "Stop Recording" button in the Patrol tab. Make sure to save all checkpoint data before ending.',
  },
  {
    question: 'What internet connection is required?',
    answer: 'The app works best with a stable 4G or WiFi connection. Some features may be limited with slower connections.',
  },
];

export default function Support() {
  const router = useRouter();
  const [selectedIssueType, setSelectedIssueType] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const handleSubmit = () => {
    if (!selectedIssueType) {
      Alert.alert('Error', 'Please select an issue type');
      return;
    }
    if (!subject.trim()) {
      Alert.alert('Error', 'Please enter a subject');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please describe your issue');
      return;
    }

    setIsSubmitting(true);
    
    // Simulate form submission
    setTimeout(() => {
      setIsSubmitting(false);
      setShowSuccessModal(true);
      
      // Reset form
      setSelectedIssueType(null);
      setSubject('');
      setDescription('');
    }, 1500);
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Us</Text>
          <Text style={styles.sectionSubtitle}>
            Having issues? We&apos;re here to help. Fill out the form below.
          </Text>
        </View>

        {/* Issue Type Selection */}
        <Text style={styles.label}>Issue Type</Text>
        <View style={styles.issueTypeGrid}>
          {ISSUE_TYPES.map((type) => (
            <TouchableOpacity
              key={type.value}
              style={[
                styles.issueTypeButton,
                selectedIssueType === type.value && { 
                  backgroundColor: type.color,
                  borderColor: type.color,
                },
              ]}
              onPress={() => setSelectedIssueType(type.value)}
            >
              <Ionicons 
                name={type.icon as any} 
                size={20} 
                color={selectedIssueType === type.value ? '#fff' : type.color} 
              />
              <Text style={[
                styles.issueTypeText,
                selectedIssueType === type.value && styles.issueTypeTextSelected,
              ]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Subject Input */}
        <Text style={styles.label}>Subject</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief description of your issue"
          placeholderTextColor="#64748b"
          value={subject}
          onChangeText={setSubject}
        />

        {/* Description Input */}
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Please provide details about your issue..."
          placeholderTextColor="#64748b"
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          value={description}
          onChangeText={setDescription}
        />

        {/* Submit Button */}
        <TouchableOpacity 
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="send" size={20} color="#fff" />
              <Text style={styles.submitButtonText}>Submit Request</Text>
            </>
          )}
        </TouchableOpacity>

        {/* FAQs Section */}
        <View style={styles.faqSection}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          
          {FAQS.map((faq, index) => (
            <TouchableOpacity
              key={index}
              style={styles.faqItem}
              onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
            >
              <View style={styles.faqQuestion}>
                <Ionicons 
                  name="help-circle-outline" 
                  size={20} 
                  color="#2563eb" 
                />
                <Text style={styles.faqQuestionText}>{faq.question}</Text>
                <Ionicons 
                  name={expandedFAQ === index ? 'chevron-up' : 'chevron-down'} 
                  size={20} 
                  color="#64748b" 
                />
              </View>
              {expandedFAQ === index && (
                <View style={styles.faqAnswer}>
                  <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Contact Info */}
        <View style={styles.contactInfo}>
          <Text style={styles.contactTitle}>Other Ways to Reach Us</Text>
          <View style={styles.contactRow}>
            <Ionicons name="mail-outline" size={20} color="#2563eb" />
            <Text style={styles.contactText}>support@omniwatch.com</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="call-outline" size={20} color="#2563eb" />
            <Text style={styles.contactText}>+1 (555) 123-4567</Text>
          </View>
          <View style={styles.contactRow}>
            <Ionicons name="time-outline" size={20} color="#2563eb" />
            <Text style={styles.contactText}>Mon-Fri: 9AM - 6PM</Text>
          </View>
        </View>
      </ScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark-circle" size={60} color="#22c55e" />
            </View>
            <Text style={styles.modalTitle}>Request Submitted!</Text>
            <Text style={styles.modalSubtitle}>
              Thank you for contacting us. We&apos;ll get back to you within 24-48 hours.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => setShowSuccessModal(false)}
            >
              <Text style={styles.modalButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    backgroundColor: '#0f172a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  label: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  issueTypeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  issueTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#374151',
    gap: 8,
  },
  issueTypeText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  issueTypeTextSelected: {
    color: '#fff',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#374151',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563eb',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
    gap: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  faqSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  faqItem: {
    backgroundColor: '#111827',
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#1e293b',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  faqQuestionText: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  faqAnswer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 0,
  },
  faqAnswerText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
  },
  contactInfo: {
    marginTop: 32,
    marginBottom: 40,
    padding: 20,
    backgroundColor: '#111827',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  contactTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  contactText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  successIcon: {
    marginBottom: 16,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  modalSubtitle: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
