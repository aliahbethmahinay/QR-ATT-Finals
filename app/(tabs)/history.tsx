import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';

import {
  getAttendanceHistory,
  getTeacherEventAttendance,
  type AttendanceRecord,
  type TeacherEventAttendance,
} from '@/lib/attendance';

import { getProfile, type Role } from '@/lib/profiles';

export default function HistoryScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);

  const [studentRecords, setStudentRecords] = useState<
    AttendanceRecord[]
  >([]);

  const [teacherEvents, setTeacherEvents] = useState<
    TeacherEventAttendance[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      setRefreshing(false);
      setErrorMessage('');
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage('');

    try {
      const profile = await getProfile(user.id);
      const currentRole: Role = profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(user.id);

        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(user.id);

        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
      setErrorMessage(
        'Unable to load attendance history. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    load(true);
  }, [load]);

  /*
   * LOADING SCREEN
   */

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Text style={styles.loadingIconText}>◷</Text>
        </View>

        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text style={styles.loadingTitle}>
          Loading attendance
        </Text>

        <Text style={styles.loadingSubtitle}>
          Please wait while we retrieve your records.
        </Text>
      </View>
    );
  }

  /*
   * ERROR SCREEN
   */

  if (errorMessage && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.emptyIcon}>
          <Text style={styles.emptyIconText}>!</Text>
        </View>

        <Text style={styles.loadingTitle}>
          Something went wrong
        </Text>

        <Text style={styles.loadingSubtitle}>
          {errorMessage}
        </Text>

        <Text
          style={styles.retryButton}
          onPress={() => load()}
        >
          Try Again
        </Text>
      </View>
    );
  }

  /*
   * TEACHER HISTORY
   */

  if (role === 'teacher') {
    const totalAttendees = teacherEvents.reduce(
      (total, event) => total + event.attendeeCount,
      0
    );

    return (
      <View style={styles.container}>
        <FlatList
          data={teacherEvents}
          keyExtractor={(item) => item.eventId}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.primary}
              colors={[COLORS.primary]}
            />
          }
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.pageTitle}>
                    Attendance History
                  </Text>

                  
                </View>

                
              </View>

              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>
                    Your Events
                  </Text>

                  <Text style={styles.sectionSubtitle}>
                    Attendance details for each event
                  </Text>
                </View>

                
              </View>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <Text style={styles.emptyIconText}>▦</Text>
              </View>

              <Text style={styles.emptyTitle}>
                No events yet
              </Text>

              <Text style={styles.emptyDescription}>
                Create an event from the Teacher tab to
                start tracking student attendance.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              <View style={styles.eventHeader}>
                <View style={styles.eventIcon}>
                  <Text style={styles.eventIconText}>▦</Text>
                </View>

                <View style={styles.eventTitleContainer}>
                  <Text
                    style={styles.eventTitle}
                    numberOfLines={2}
                  >
                    {item.title}
                  </Text>

                  <Text style={styles.eventCode}>
                    CODE: {item.eventCode}
                  </Text>
                </View>

                <View style={styles.countBadge}>
                  <Text style={styles.countText}>
                    {item.attendeeCount}
                  </Text>

                  <Text style={styles.countLabel}>
                    Attendees
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              {item.startTime ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>◷</Text>

                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>
                      Starts
                    </Text>

                    <Text style={styles.infoValue}>
                      {formatDate(item.startTime)}
                    </Text>
                  </View>
                </View>
              ) : null}

              {item.endTime ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoIcon}>◷</Text>

                  <View style={styles.infoTextContainer}>
                    <Text style={styles.infoLabel}>
                      Ends
                    </Text>

                    <Text style={styles.infoValue}>
                      {formatDate(item.endTime)}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.attendeeSectionHeader}>
                <Text style={styles.attendeeSectionTitle}>
                  Students who attended
                </Text>

                
              </View>

              {item.attendees.length === 0 ? (
                <View style={styles.noAttendeesBox}>
                  <Text style={styles.noAttendees}>
                    No students have scanned this event yet.
                  </Text>
                </View>
              ) : (
                <View style={styles.attendeeList}>
                  {item.attendees.map((attendee, index) => (
                    <View
                      key={`${attendee.studentId}-${attendee.scannedAt}`}
                      style={[
                        styles.attendeeRow,
                        index === item.attendees.length - 1 &&
                          styles.lastAttendeeRow,
                      ]}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {getInitials(attendee.studentName)}
                        </Text>
                      </View>

                      <View style={styles.attendeeInfo}>
                        <Text
                          style={styles.studentName}
                          numberOfLines={1}
                        >
                          {attendee.studentName ||
                            'Name unavailable'}
                        </Text>

                        <Text style={styles.scanTime}>
                          {formatDate(attendee.scannedAt)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
          ListFooterComponent={
            teacherEvents.length > 0 ? (
              <Text style={styles.footerText}>
                Pull down to refresh your attendance records.
              </Text>
            ) : null
          }
        />
      </View>
    );
  }

  /*
   * STUDENT HISTORY
   */

  return (
    <View style={styles.container}>
      <FlatList
        data={studentRecords}
        keyExtractor={(item) => String(item.id)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerTextContainer}>
                <Text style={styles.pageTitle}>
                  Attendance History
                </Text>

               
              </View>

              
            </View>

            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>
                  Your Records
                </Text>

                <Text style={styles.sectionSubtitle}>
                  Your attendance activity
                </Text>
              </View>

              
            </View>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>▤</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No attendance records yet
            </Text>

            <Text style={styles.emptyDescription}>
              Scan an event QR code to register your
              attendance. Your recorded events will
              appear here.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.historyCard}>
            <View style={styles.eventHeader}>
              <View style={styles.eventIcon}>
                <Text style={styles.eventIconText}>▦</Text>
              </View>

              <View style={styles.eventTitleContainer}>
                <Text
                  style={styles.eventTitle}
                  numberOfLines={2}
                >
                  {item.eventTitle || 'Untitled Event'}
                </Text>

                <Text style={styles.eventCode}>
                  CODE: {item.eventId || 'Unavailable'}
                </Text>
              </View>

              <View style={styles.attendedBadge}>
                <Text style={styles.attendedCheck}>✓</Text>

                <Text style={styles.attendedText}>
                  Recorded
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoIcon}>◷</Text>

              <View style={styles.infoTextContainer}>
                <Text style={styles.infoLabel}>
                  Attendance Date & Time
                </Text>

                <Text style={styles.infoValue}>
                  {formatDate(item.scannedAt)}
                </Text>
              </View>
            </View>

            <View style={styles.recordFooter}>
              <Text style={styles.recordFooterText}>
                Attendance successfully recorded
              </Text>

              <View style={styles.recordStatusDot} />
            </View>
          </View>
        )}
        ListFooterComponent={
          studentRecords.length > 0 ? (
            <Text style={styles.footerText}>
              Pull down to refresh your attendance records.
            </Text>
          ) : null
        }
      />
    </View>
  );
}

/*
 * FORMAT DATE
 */

function formatDate(iso: string) {
  if (!iso) {
    return 'Unknown date';
  }

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  return date.toLocaleString();
}

/*
 * STUDENT INITIALS
 */

function getInitials(name: string | null | undefined) {
  if (!name || !name.trim()) {
    return '?';
  }

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

/*
 * STYLES
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    flexGrow: 1,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    marginBottom: 22,
  },

  headerTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
    marginTop: 20,
    textAlign: 'center',
  },

  pageSubtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginTop: 6,
  },

  headerIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  headerIconText: {
    color: COLORS.primary,
    fontSize: 35,
    fontWeight: '500',
  },

  welcomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  welcomeIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 15,
  },

  welcomeIconText: {
    fontSize: 29,
    fontWeight: '800',
    color: COLORS.primary,
  },

  welcomeTextContainer: {
    flex: 1,
  },

  welcomeTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  welcomeSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  statsRow: {
    flexDirection: 'row',
    marginBottom: 27,
    gap: 12,
  },

  statCard: {
    flex: 1,
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  statIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  statIconText: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.primary,
  },

  statTextContainer: {
    flex: 1,
    marginLeft: 10,
  },

  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 17,
  },

  statValue: {
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.primary,
    marginTop: 2,
  },

  studentStatsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 25,
  },

  studentStatsText: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
  },

  studentStatsDescription: {
    fontSize: 11,
    color: COLORS.textSecondary,
    lineHeight: 16,
    marginTop: 4,
  },

  studentStatsValue: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.primary,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  sectionSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  sectionBadge: {
    minWidth: 35,
    height: 35,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionBadgeText: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
  },

  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  eventIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  eventIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: COLORS.primary,
  },

  eventTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },

  eventTitle: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    color: COLORS.textPrimary,
  },

  eventCode: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  countBadge: {
    minWidth: 58,
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },

  countText: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.primary,
  },

  countLabel: {
    fontSize: 9,
    fontWeight: '600',
    color: COLORS.primaryDark,
    marginTop: 2,
  },

  attendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    paddingHorizontal: 9,
    paddingVertical: 7,
    marginLeft: 5,
  },

  attendedCheck: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.success,
    marginRight: 4,
  },

  attendedText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.success,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },

  infoIcon: {
    width: 25,
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.primary,
    marginRight: 9,
    textAlign: 'center',
  },

  infoTextContainer: {
    flex: 1,
  },

  infoLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: 3,
  },

  infoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: COLORS.textPrimary,
    lineHeight: 19,
  },

  attendeeSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 3,
    marginBottom: 10,
  },

  attendeeSectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    flex: 1,
  },

  smallBadge: {
    minWidth: 28,
    height: 27,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  smallBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  attendeeList: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    paddingHorizontal: 11,
    paddingVertical: 4,
  },

  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  lastAttendeeRow: {
    borderBottomWidth: 0,
  },

  avatar: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  avatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.primary,
  },

  attendeeInfo: {
    flex: 1,
  },

  studentName: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },

  scanTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },

  noAttendeesBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: COLORS.surface,
  },

  noAttendees: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  recordFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 3,
  },

  recordFooterText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },

  recordStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginLeft: 8,
  },

  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 25,
    paddingVertical: 32,
    marginTop: 3,
  },

  emptyIcon: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },

  emptyIconText: {
    fontSize: 38,
    fontWeight: '700',
    color: COLORS.primary,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },

  emptyDescription: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
  },

  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 12,
  },

  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  loadingIcon: {
    width: 75,
    height: 75,
    borderRadius: 25,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },

  loadingIconText: {
    fontSize: 42,
    color: COLORS.primary,
  },

  loadingTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 16,
  },

  loadingSubtitle: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  retryButton: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 22,
  },
});