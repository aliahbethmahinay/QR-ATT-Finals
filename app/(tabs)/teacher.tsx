
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import {
  createEvent,
  getTeacherDashboardStats,
} from '@/lib/events';
import type { TeacherDashboardStats } from '@/lib/events';
import { getProfile } from '@/lib/profiles';
import type { Role } from '@/lib/profiles';

function toLocalISO(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}:00`;
}

function formatDateTime(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');

  const month = date.toLocaleString('en-US', {
    month: 'short',
  });

  return `${month} ${pad(date.getDate())}, ${date.getFullYear()} at ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

const QUICK_END_OPTIONS = [
  { label: '+30 min', ms: 30 * 60 * 1000 },
  { label: '+1 hour', ms: 60 * 60 * 1000 },
  { label: '+2 hours', ms: 2 * 60 * 60 * 1000 },
];

type EditTarget = 'start' | 'end';

export default function TeacherScreen() {
  const { user } = useAuth();

  const [role, setRole] = useState<Role | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  const [dashboard, setDashboard] =
    useState<TeacherDashboardStats | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [eventId, setEventId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(
    () => new Date(Date.now() + 60 * 60 * 1000)
  );

  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [editingPart, setEditingPart] = useState<'date' | 'time'>('date');
  const [payload, setPayload] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [creatingEvent, setCreatingEvent] = useState(false);

  const isAndroid = Platform.OS === 'android';

  const loadDashboard = useCallback(async (teacherId: string) => {
    setDashboardLoading(true);
    setDashboardError(null);

    try {
      const result = await getTeacherDashboardStats(teacherId);

      if (result.error) {
        setDashboardError(result.error);
        setDashboard(null);
      } else {
        setDashboard(result.data);
      }
    } catch (error: unknown) {
      setDashboardError(
        error instanceof Error
          ? error.message
          : 'Unable to load dashboard statistics.'
      );
      setDashboard(null);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      async function loadAccount() {
        if (!user) {
          setRole(null);
          setRoleLoading(false);
          setDashboard(null);
          setDashboardLoading(false);
          return;
        }

        setRoleLoading(true);

        try {
          const profile = await getProfile(user.id);

          if (!active) return;

          const currentRole = profile?.role ?? 'student';
          setRole(currentRole);
          setRoleLoading(false);

          if (currentRole === 'teacher') {
            setDashboardLoading(true);
            setDashboardError(null);

            try {
              const result = await getTeacherDashboardStats(user.id);

              if (!active) return;

              if (result.error) {
                setDashboardError(result.error);
                setDashboard(null);
              } else {
                setDashboard(result.data);
              }
            } finally {
              if (active) setDashboardLoading(false);
            }
          } else {
            setDashboard(null);
            setDashboardLoading(false);
          }
        } catch (error: unknown) {
          if (!active) return;

          setRoleLoading(false);
          setDashboardLoading(false);
          setDashboardError(
            error instanceof Error
              ? error.message
              : 'Unable to load your account.'
          );
        }
      }

      loadAccount();

      return () => {
        active = false;
      };
    }, [user])
  );

  const openPicker = (target: EditTarget) => {
    setMessage(null);
    setEditTarget(target);
    setEditingPart('date');
  };

  const onPickerChange = (
    event: DateTimePickerEvent,
    selected?: Date
  ) => {
    if (!editTarget) return;

    if (event.type === 'dismissed' || !selected) {
      setEditTarget(null);
      setEditingPart('date');
      return;
    }

    const current = editTarget === 'start' ? startDate : endDate;
    const next = new Date(current);

    next.setFullYear(
      selected.getFullYear(),
      selected.getMonth(),
      selected.getDate()
    );

    next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);

    if (editTarget === 'start') {
      setStartDate(next);
    } else {
      setEndDate(next);
    }

    if (isAndroid && editingPart === 'date') {
      setEditingPart('time');
    } else {
      setEditTarget(null);
      setEditingPart('date');
    }
  };

  const handleQuickEnd = (ms: number) => {
    setMessage(null);
    setEndDate(new Date(startDate.getTime() + ms));
  };

  const handleCreateEvent = async () => {
    setMessage(null);

    const event = {
      eventId: eventId.trim(),
      title: title.trim(),
      start: toLocalISO(startDate),
      end: toLocalISO(endDate),
    };

    if (!event.eventId || !event.title) {
      setMessage('Event title and code are required.');
      return;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      setMessage('End time must be after start time.');
      return;
    }

    if (!user) {
      setMessage('You must be signed in to create an event.');
      return;
    }

    setCreatingEvent(true);

    try {
      const result = await createEvent(event);

      if (result.error) {
        setMessage(`Unable to create event: ${result.error}`);
        return;
      }

      setMessage('Event saved! Your dashboard has been refreshed.');

      setPayload(
        JSON.stringify({
          v: 1,
          event: event.eventId,
          title: event.title,
          start: event.start,
          end: event.end,
        })
      );

      await loadDashboard(user.id);
    } catch (error: unknown) {
      setMessage(
        error instanceof Error
          ? `Unable to create event: ${error.message}`
          : 'An unexpected error occurred.'
      );
    } finally {
      setCreatingEvent(false);
    }
  };

  if (roleLoading) {
    return (
      <View style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Checking your account...</Text>
        </View>
      </View>
    );
  }

  if (role !== 'teacher') {
    return (
      <View style={styles.container}>
        <View style={styles.accessDeniedContent}>
          <Ionicons
            name="lock-closed-outline"
            size={56}
            color={COLORS.primary}
          />
          <Text style={styles.accessDeniedTitle}>Teachers Only</Text>
          <Text style={styles.accessDeniedSubtitle}>
            Only teacher accounts can create events and view the teacher
            dashboard.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.pageTitle}>Teacher Dashboard</Text>
      

      {/* Dashboard summary cards */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="calendar-outline"
          label="Total Events Created"
          value={
            dashboardLoading
              ? '...'
              : String(dashboard?.totalEvents ?? 0)
          }
        />

        <StatCard
          icon="people-outline"
          label="Attendance Records"
          value={
            dashboardLoading
              ? '...'
              : String(dashboard?.totalAttendanceRecords ?? 0)
          }
        />

        <StatCard
          icon="person-outline"
          label="Registered Students"
          value={
            dashboardLoading
              ? '...'
              : String(dashboard?.totalRegisteredStudents ?? 0)
          }
        />
      </View>

      {dashboardLoading && (
        <View style={styles.inlineLoading}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={styles.mutedText}>Loading events...</Text>
        </View>
      )}

      {dashboardError && (
        <View style={styles.errorCard}>
          <Ionicons
            name="alert-circle-outline"
            size={20}
            color={COLORS.danger}
          />
          <View style={styles.errorContent}>
            <Text style={styles.errorTitle}>Dashboard unavailable</Text>
            <Text style={styles.errorText}>{dashboardError}</Text>
            <Pressable
              onPress={() => user && loadDashboard(user.id)}
              style={styles.retryButton}
            >
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        </View>
      )}

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Attendance by Event</Text>

        <Pressable
          onPress={() => user && loadDashboard(user.id)}
          disabled={dashboardLoading}
          style={styles.refreshButton}
        >
          <Ionicons
            name="refresh-outline"
            size={18}
            color={COLORS.primary}
          />
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {!dashboardLoading &&
        !dashboardError &&
        (dashboard?.events.length ?? 0) === 0 && (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={32}
              color={COLORS.textSecondary}
            />
            <Text style={styles.emptyTitle}>No events yet</Text>
            <Text style={styles.emptyText}>
              Create your first event below. Its attendance statistics will
              appear here.
            </Text>
          </View>
        )}

      {!dashboardLoading &&
        !dashboardError &&
        dashboard?.events.map((event) => {
          const percentage = Math.min(
            100,
            Math.max(0, event.attendancePercentage)
          );
          const eventStatus = String(
            (event as typeof event & { status?: string }).status ?? ''
          ).toLowerCase();
          const isOpen = eventStatus === 'open';
          const isClosed = eventStatus === 'closed';

          return (
            <View key={event.id} style={styles.eventStatCard}>
              <View style={styles.eventIcon}>
                <Ionicons
                  name="calendar"
                  size={22}
                  color={COLORS.primary}
                />
              </View>

              <View style={styles.eventDetails}>
                <View style={styles.eventTitleRow}>
                  <Text style={styles.eventTitle}>{event.title}</Text>
                  {(isOpen || isClosed) && (
                    <View
                      style={[
                        styles.statusBadge,
                        isOpen ? styles.openBadge : styles.closedBadge,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusBadgeText,
                          isOpen ? styles.openBadgeText : styles.closedBadgeText,
                        ]}
                      >
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </Text>
                    </View>
                  )}
                </View>

                <Text style={styles.eventCode}>
                  Code: {event.event_code}
                </Text>

                <Text style={styles.eventCreated}>
                  Created{' '}
                  {new Date(event.created_at).toLocaleDateString()}
                </Text>

                <View style={styles.percentageHeader}>
                  <Text style={styles.percentageLabel}>
                    Attendance rate
                  </Text>
                  <Text style={styles.percentageValue}>
                    {event.attendancePercentage}%
                  </Text>
                </View>

                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${percentage}%` },
                    ]}
                  />
                </View>

                <Text style={styles.attendanceDetail}>
                  {event.attendanceCount} of{' '}
                  {dashboard.totalRegisteredStudents} registered students
                </Text>
              </View>
            </View>
          );
        })}

      <View style={styles.sectionDivider} />

      {/* Existing event creation form */}
      <Text style={styles.sectionTitle}>Create Event QR</Text>
      <Text style={styles.subtitle}>
        Fill in the event details, then scan the generated QR with the Scan
        tab.
      </Text>

      <Text style={styles.label}>Event Title</Text>
      <TextInput
        style={styles.input}
        value={title}
        onChangeText={setTitle}
        placeholder="e.g. Founders Day Assembly"
        placeholderTextColor={COLORS.textSecondary}
      />

      <Text style={styles.label}>Event Code</Text>
      <TextInput
        style={styles.input}
        value={eventId}
        onChangeText={setEventId}
        placeholder="e.g. EVT-2026-0002"
        placeholderTextColor={COLORS.textSecondary}
        autoCapitalize="characters"
      />

      <Text style={styles.label}>Starts</Text>
      <PickerField
        value={formatDateTime(startDate)}
        icon="sunny-outline"
        onPress={() => openPicker('start')}
      />

      <Text style={styles.label}>Ends</Text>
      <PickerField
        value={formatDateTime(endDate)}
        icon="moon-outline"
        onPress={() => openPicker('end')}
      />

      <View style={styles.chipRow}>
        {QUICK_END_OPTIONS.map((option) => (
          <Pressable
            key={option.label}
            style={styles.chip}
            onPress={() => handleQuickEnd(option.ms)}
          >
            <Text style={styles.chipText}>{option.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.hint}>
        Tap a chip to set the end time from the start time.
      </Text>

      {message && <Text style={styles.message}>{message}</Text>}

      <AppButton
        theme="primary"
        title={creatingEvent ? 'Creating Event...' : 'Create Event'}
        icon="add-circle-outline"
        onPress={handleCreateEvent}
      />

      {editTarget && (
        <View style={styles.pickerContainer}>
          <DateTimePicker
            value={editTarget === 'start' ? startDate : endDate}
            mode={isAndroid ? editingPart : 'datetime'}
            display={isAndroid ? 'default' : 'spinner'}
            onChange={onPickerChange}
          />
        </View>
      )}

      {payload && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>
            Scan this QR code with the Scan tab:
          </Text>

          <View style={styles.qrBox}>
            <QRCode value={payload} size={200} />
          </View>

          <Text style={styles.payloadText}>{payload}</Text>
        </View>
      )}
    </ScrollView>
  );
}

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
};

function StatCard({ icon, label, value }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={23} color={COLORS.primary} />
      </View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

type PickerFieldProps = {
  value: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

function PickerField({ value, icon, onPress }: PickerFieldProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.pickerField,
        pressed && styles.pickerFieldPressed,
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <Text style={styles.pickerValue}>{value}</Text>
      <Ionicons
        name="calendar-outline"
        size={18}
        color={COLORS.textSecondary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  pageTitle: {
    fontSize: 20,
    lineHeight: 34,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.6,
    marginBottom: 6,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    marginBottom: 22,
    textAlign: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 18,
  },
  statCard: {
    flex: 1,
    minWidth: 95,
    minHeight: 125,
    padding: 10,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 16,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  mutedText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderColor: COLORS.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  errorContent: {
    flex: 1,
  },
  errorTitle: {
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 27,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 10,
    textAlign: 'center'
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 6,
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  eventStatCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  eventIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDetails: {
    flex: 1,
    minWidth: 0,
  },
  eventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 4,
  },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  openBadge: {
    backgroundColor: '#DCFCE7',
    borderColor: '#86EFAC',
  },
  closedBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  openBadgeText: {
    color: '#166534',
  },
  closedBadgeText: {
    color: '#991B1B',
  },
  eventCode: {
    color: COLORS.textSecondary,
    fontSize: 11,
  },
  eventCreated: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  percentageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 6,
  },
  percentageLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  percentageValue: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  progressTrack: {
    height: 7,
    backgroundColor: COLORS.surface,
    borderRadius: 99,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 99,
  },
  attendanceDetail: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 14,
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 7,
    marginTop: 14,
  },
  input: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  pickerField: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pickerFieldPressed: {
    backgroundColor: COLORS.surface,
  },
  pickerValue: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.textPrimary,
    marginHorizontal: 10,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  chip: {
    backgroundColor: COLORS.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    marginBottom: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  hint: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 6,
  },
  pickerContainer: {
    marginTop: 12,
    alignItems: 'center',
  },
  message: {
    fontSize: 13,
    color: COLORS.primary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  resultCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 12,
  },
  qrBox: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },
  payloadText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 16,
  },
  accessDeniedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  accessDeniedTitle: {
    marginTop: 14,
    marginBottom: 8,
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },
  accessDeniedSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 280,
  },
});
