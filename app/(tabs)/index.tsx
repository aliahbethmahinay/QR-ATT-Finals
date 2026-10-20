import { router, useFocusEffect } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useState } from 'react';

import Header from '@/components/Header';
import { COLORS } from '@/constants/colors';
import { getUpcomingEvents, type CloudEvent } from '@/lib/events';

export default function Index() {
  const [upcomingEvents, setUpcomingEvents] = useState<CloudEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const loadUpcomingEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEventsError(null);

    try {
      const events = await getUpcomingEvents();
      setUpcomingEvents(events);
    } catch (error) {
      console.error('Unable to load upcoming events:', error);

      setEventsError(
        error instanceof Error
          ? error.message
          : 'Unable to load upcoming events.'
      );
    } finally {
      setLoadingEvents(false);
    }
  }, []);

  // Refresh the event list whenever the Home tab is opened.
  useFocusEffect(
    useCallback(() => {
      loadUpcomingEvents();
    }, [loadUpcomingEvents])
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.headerContainer}>
          <Header title="QR-ATT" />

          <Text style={styles.author}>
            School Event Attendance
          </Text>
        </View>

        {/* WELCOME SECTION */}
        <View style={styles.welcomeSection}>
          <View style={styles.welcomeTextContainer}>
            <Text style={styles.welcomeLabel}>
              WELCOME!
            </Text>

            <Text style={styles.welcomeTitle}>
              School Event{'\n'}
              <Text style={styles.titleHighlight}>
                Attendance
              </Text>
            </Text>

            <Text style={styles.welcomeDescription}>
              Scan event QR codes, track your attendance,
              and stay updated with school activities.
            </Text>
          </View>

          <View style={styles.welcomeIconContainer}>
            <Ionicons
              name="qr-code"
              size={62}
              color={COLORS.textOnPrimary}
            />
          </View>

          <View style={styles.decorativeCircle} />
        </View>

        {/* SCAN QR CARD */}
        <View style={styles.scanCard}>
          <View style={styles.scanCardHeader}>
            <View style={styles.scanIconContainer}>
              <Ionicons
                name="qr-code-outline"
                size={35}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.scanTextContainer}>
              <Text style={styles.scanTitle}>
                Scan QR Code
              </Text>

              <Text style={styles.scanDescription}>
                Scan the QR code provided by your teacher
                to record your attendance.
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.scanButton,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push('/scan')}
          >
            <Ionicons
              name="scan-outline"
              size={22}
              color={COLORS.textOnPrimary}
            />

            <Text style={styles.scanButtonText}>
              Scan QR Code
            </Text>

            <Ionicons
              name="arrow-forward"
              size={20}
              color={COLORS.textOnPrimary}
            />
          </Pressable>

          <View style={styles.secureNotice}>
            <Ionicons
              name="shield-checkmark-outline"
              size={17}
              color={COLORS.primary}
            />

            <Text style={styles.secureNoticeText}>
              Record attendance using your account
            </Text>
          </View>
        </View>

        {/* QUICK ACCESS */}
        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Quick Access
            </Text>

            <Text style={styles.sectionSubtitle}>
              Manage your attendance information
            </Text>
          </View>
        </View>

        <View style={styles.quickAccessContainer}>
          {/* ATTENDANCE HISTORY */}
          <Pressable
            style={({ pressed }) => [
              styles.quickAccessCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/history')}
          >
            <View style={styles.historyIconContainer}>
              <Ionicons
                name="time-outline"
                size={28}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.quickAccessTitleRow}>
              <Text style={styles.quickAccessTitle}>
                Attendance History
              </Text>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.quickAccessDescription}>
              Review your previous attendance records.
            </Text>
          </Pressable>

          {/* PROFILE */}
          <Pressable
            style={({ pressed }) => [
              styles.quickAccessCard,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push('/profile')}
          >
            <View style={styles.profileIconContainer}>
              <Ionicons
                name="person-outline"
                size={28}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.quickAccessTitleRow}>
              <Text style={styles.quickAccessTitle}>
                My Profile
              </Text>

              <Ionicons
                name="chevron-forward"
                size={19}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.quickAccessDescription}>
              View your account and personal information.
            </Text>
          </Pressable>
        </View>

        {/* UPCOMING EVENTS */}
        <View style={styles.eventsHeader}>
          <View>
            <Text style={styles.sectionTitle}>
              Upcoming Events
            </Text>

            <Text style={styles.sectionSubtitle}>
              Stay ready for your next activity
            </Text>
          </View>

          <Ionicons
            name="calendar-outline"
            size={24}
            color={COLORS.primary}
          />
        </View>

        {/* LOADING */}
        {loadingEvents ? (
          <View style={styles.messageCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.messageText}>
              Loading upcoming events...
            </Text>
          </View>
        ) : eventsError ? (
          /* ERROR */
          <View style={styles.messageCard}>
            <View style={styles.emptyEventsIcon}>
              <Ionicons
                name="alert-circle-outline"
                size={30}
                color={COLORS.danger}
              />
            </View>

            <Text style={styles.emptyEventsTitle}>
              Events unavailable
            </Text>

            <Text style={styles.emptyEventsDescription}>
              {eventsError}
            </Text>

            <Pressable
              style={styles.retryButton}
              onPress={loadUpcomingEvents}
            >
              <Ionicons
                name="refresh-outline"
                size={18}
                color={COLORS.textOnPrimary}
              />

              <Text style={styles.retryButtonText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : upcomingEvents.length === 0 ? (
          /* NO EVENTS */
          <View style={styles.emptyEventsCard}>
            <View style={styles.emptyEventsIcon}>
              <Ionicons
                name="calendar-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>

            <View style={styles.emptyEventsTextContainer}>
              <Text style={styles.emptyEventsTitle}>
                No upcoming events
              </Text>

              <Text style={styles.emptyEventsDescription}>
                Check back later for new school events.
              </Text>
            </View>
          </View>
        ) : (
          /* EVENT LIST */
          upcomingEvents.map((event) => (
            <View
              key={event.id}
              style={styles.eventCard}
            >
              <View style={styles.eventIconContainer}>
                <Ionicons
                  name="calendar-outline"
                  size={27}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.eventTextContainer}>
                <Text style={styles.eventTitle}>
                  {event.title}
                </Text>

                <View style={styles.eventDetailRow}>
                  <Ionicons
                    name="time-outline"
                    size={15}
                    color={COLORS.textSecondary}
                  />

                  <Text style={styles.eventDetailText}>
                    {event.start_time
                      ? new Date(event.start_time).toLocaleString()
                      : 'Schedule to be announced'}
                  </Text>
                </View>

                {event.end_time ? (
                  <View style={styles.eventDetailRow}>
                    <Ionicons
                      name="flag-outline"
                      size={15}
                      color={COLORS.textSecondary}
                    />

                    <Text style={styles.eventDetailText}>
                      Ends: {new Date(event.end_time).toLocaleString()}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          ))
        )}

        {/* FOOTER */}
        <View style={styles.footer}>
          <View style={styles.footerDivider} />

          <Text style={styles.footerTitle}>
            QR-ATT
          </Text>

          <Text style={styles.footerDescription}>
            School Event Attendance Management System
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },

  // HEADER
  headerContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },

  author: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: -8,
    letterSpacing: 0.3,
  },

  // WELCOME BANNER
  welcomeSection: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
    minHeight: 190,
  },

  welcomeTextContainer: {
    flex: 1,
    zIndex: 1,
    paddingRight: 6,
  },

  welcomeLabel: {
    color: '#BFDBFE',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 8,
  },

  welcomeTitle: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 31,
    color: COLORS.textOnPrimary,
    marginBottom: 10,
  },

  titleHighlight: {
    color: '#BFDBFE',
  },

  welcomeDescription: {
    fontSize: 12,
    color: '#EFF6FF',
    lineHeight: 18,
  },

  welcomeIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    zIndex: 1,
  },

  decorativeCircle: {
    position: 'absolute',
    width: 155,
    height: 155,
    borderRadius: 78,
    backgroundColor: 'rgba(255,255,255,0.07)',
    right: -45,
    bottom: -75,
  },

  // SCAN CARD
  scanCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },

  scanCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },

  scanIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  scanTextContainer: {
    flex: 1,
  },

  scanTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 6,
  },

  scanDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  scanButton: {
    minHeight: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },

  scanButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },

  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.99 }],
  },

  secureNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 7,
  },

  secureNoticeText: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  // SECTION HEADINGS
  sectionHeader: {
    marginBottom: 14,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },

  // QUICK ACCESS CARDS
  quickAccessContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 28,
  },

  quickAccessCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 170,
  },

  cardPressed: {
    opacity: 0.75,
  },

  historyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  profileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  quickAccessTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginBottom: 7,
  },

  quickAccessTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  quickAccessDescription: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  // UPCOMING EVENTS
  eventsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  messageCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 22,
    marginBottom: 12,
    gap: 12,
  },

  messageText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },

  emptyEventsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    gap: 13,
    marginBottom: 12,
  },

  emptyEventsIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  emptyEventsTextContainer: {
    flex: 1,
  },

  emptyEventsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  emptyEventsDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 4,
  },

  retryButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  eventCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    gap: 13,
    marginBottom: 12,
  },

  eventIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  eventTextContainer: {
    flex: 1,
  },

  eventTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 7,
  },

  eventDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 4,
  },

  eventDetailText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
  },

  // FOOTER
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },

  footerDivider: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.primary,
    marginBottom: 12,
  },

  footerTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  footerDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 17,
  },
});