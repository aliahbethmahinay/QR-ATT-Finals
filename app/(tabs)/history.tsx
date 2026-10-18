import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import {
  FlatList,
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

  const load = useCallback(async () => {
    if (!user) {
      setRole(null);
      setStudentRecords([]);
      setTeacherEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);

      const currentRole: Role =
        profile?.role ?? 'student';

      setRole(currentRole);

      if (currentRole === 'teacher') {
        const events = await getTeacherEventAttendance(
          user.id
        );

        setTeacherEvents(events);
        setStudentRecords([]);
      } else {
        const records = await getAttendanceHistory(
          user.id
        );

        setStudentRecords(records);
        setTeacherEvents([]);
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  /*
   * ==========================================
   * TEACHER HISTORY
   * ==========================================
   */

  if (role === 'teacher') {
    return (
      <View style={styles.container}>
        <Text style={styles.pageTitle}>
          Attendance History
        </Text>

        <Text style={styles.sectionTitle}>
        </Text>

        {loading ? (
          <Text style={styles.subtitle}>
            Loading events...
          </Text>
        ) : teacherEvents.length === 0 ? (
          <Text style={styles.subtitle}>
            No events yet. Create an event from
            the Teacher tab.
          </Text>
        ) : (
          <FlatList
            data={teacherEvents}
            keyExtractor={(item) => item.eventId}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              return (
                <View style={styles.historyCard}>
                  {/* EVENT TITLE AND ATTENDEE COUNT */}
                  <View style={styles.eventHeader}>
                    <Text
                      style={styles.eventTitle}
                      numberOfLines={2}
                    >
                      {item.title}
                    </Text>

                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>
                        {item.attendeeCount}
                      </Text>
                    </View>
                  </View>

                  {/* EVENT CODE */}
                  <Text style={styles.infoText}>
                    Event Code: {item.eventCode}
                  </Text>

                  {/* START TIME */}
                  {item.startTime ? (
                    <Text style={styles.infoText}>
                      Start: {formatDate(item.startTime)}
                    </Text>
                  ) : null}

                  {/* END TIME */}
                  {item.endTime ? (
                    <Text style={styles.infoText}>
                      End: {formatDate(item.endTime)}
                    </Text>
                  ) : null}

                  {/* ATTENDEE COUNT */}
                  <Text style={styles.infoText}>
                    Attendees: {item.attendeeCount}
                  </Text>

                  {/* STUDENT LIST */}
                  {item.attendees.length === 0 ? (
                    <Text style={styles.noAttendees}>
                      No students have scanned yet.
                    </Text>
                  ) : (
                    <View style={styles.attendeeList}>
                      {item.attendees.map((attendee) => (
                        <View
                          key={`${attendee.studentId}-${attendee.scannedAt}`}
                          style={styles.attendeeRow}
                        >
                          {/* DISPLAY STUDENT NAME */}
                          <Text style={styles.studentId}>
                            {attendee.studentName ||
                              'Name unavailable'}
                          </Text>

                          {/* SCAN DATE AND TIME */}
                          <Text style={styles.scanTime}>
                            {' - '}
                            {formatDate(attendee.scannedAt)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    );
  }

  /*
   * ==========================================
   * STUDENT HISTORY
   * ==========================================
   */

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>
        Attendance History
      </Text>

      <Text style={styles.sectionTitle}>
      </Text>

      {loading ? (
        <Text style={styles.subtitle}>
          Loading records...
        </Text>
      ) : studentRecords.length === 0 ? (
        <Text style={styles.subtitle}>
          No records yet. Scan a QR code to
          register your attendance.
        </Text>
      ) : (
        <FlatList
          data={studentRecords}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.historyCard}>
              {/* EVENT TITLE */}
              <Text
                style={styles.eventTitle}
                numberOfLines={2}
              >
                {item.eventTitle}
              </Text>

              {/* EVENT CODE */}
              <Text style={styles.infoText}>
                Event Code: {item.eventId}
              </Text>

              {/* SCAN TIME */}
              <Text style={styles.infoText}>
                Attended: {formatDate(item.scannedAt)}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

/*
 * ==========================================
 * FORMAT DATE
 * ==========================================
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
 * ==========================================
 * STYLES
 * ==========================================
 */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    paddingTop: 20,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 20,
    textAlign: 'center',
    color: COLORS.textPrimary,
    marginBottom: 1,
  },

  sectionTitle: {
    fontSize: 21,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 18,
  },

  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 32,
    paddingHorizontal: 15,
  },

  list: {
    paddingBottom: 30,
  },

  historyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 4,
  },

  eventHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 7,
  },

  eventTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginRight: 10,
    lineHeight: 22,
  },

  infoText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
    lineHeight: 19,
  },

  countBadge: {
    minWidth: 32,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.success,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  countText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },

  attendeeList: {
    marginTop: 6,
  },

  attendeeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: 4,
    paddingBottom: 2,
  },

  studentId: {
    fontSize: 13,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },

  scanTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },

  noAttendees: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 7,
  },
});
