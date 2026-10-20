
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getProfile } from '@/lib/profiles';

type UserRole = 'student' | 'teacher' | 'admin';

type UserProfile = {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at?: string;
};

type AdminEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
  status: 'open' | 'closed';
};

type DashboardStats = {
  total_events: number;
  upcoming_events: number;
  completed_events: number;
  total_attendance: number;
  unique_attendees: number;
};

type ReportAttendee = {
  student_id: string;
  full_name: string | null;
  email: string;
  scanned_at: string;
};

type AttendanceReport = {
  event_id: string;
  event_title: string;
  start_time: string | null;
  end_time: string | null;
  total_students: number;
  attendee_count: number;
  attendance_percentage: number;
  attendees: ReportAttendee[];
};

const EMPTY_STATS: DashboardStats = {
  total_events: 0,
  upcoming_events: 0,
  completed_events: 0,
  total_attendance: 0,
  unique_attendees: 0,
};

const ROLES: UserRole[] = ['student', 'teacher', 'admin'];

export default function AdminScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventCode, setEventCode] = useState('');
  const [eventStart, setEventStart] = useState('');
  const [eventEnd, setEventEnd] = useState('');
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);
  const [pickerStage, setPickerStage] = useState<'date' | 'time'>('date');
  const [pickerValue, setPickerValue] = useState(new Date());
  const [stats, setStats] = useState<DashboardStats>(EMPTY_STATS);
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!user) {
      setStats(EMPTY_STATS);
      setStatsLoading(false);
      return;
    }

    setStatsLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        'admin_get_dashboard_stats'
      );

      if (error) throw error;

      setStats({
        total_events: Number(data?.total_events ?? 0),
        upcoming_events: Number(data?.upcoming_events ?? 0),
        completed_events: Number(data?.completed_events ?? 0),
        total_attendance: Number(data?.total_attendance ?? 0),
        unique_attendees: Number(data?.unique_attendees ?? 0),
      });
    } catch (error) {
      console.error('Failed to load statistics:', error);
      Alert.alert('Statistics Unavailable', 'Please refresh and try again.');
    } finally {
      setStatsLoading(false);
    }
  }, [user]);

  const loadReports = useCallback(async () => {
    if (!user) {
      setReports([]);
      setReportsLoading(false);
      return;
    }

    setReportsLoading(true);

    try {
      const { data, error } = await supabase.rpc(
        'admin_get_attendance_reports'
      );

      if (error) throw error;

      const parsedReports = Array.isArray(data)
        ? (data as AttendanceReport[])
        : [];

      setReports(parsedReports);

      setSelectedEventId((currentId) => {
        if (
          currentId &&
          parsedReports.some((report) => report.event_id === currentId)
        ) {
          return currentId;
        }

        return parsedReports[0]?.event_id ?? null;
      });
    } catch (error) {
      console.error('Failed to load attendance reports:', error);
      Alert.alert(
        'Attendance Reports Unavailable',
        'Could not load reports. Check the Supabase function and try again.'
      );
    } finally {
      setReportsLoading(false);
    }
  }, [user]);

  const loadUsers = useCallback(async () => {
    if (!user) {
      setAuthorized(false);
      setUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const profile = await getProfile(user.id);

      if (profile?.role !== 'admin') {
        setAuthorized(false);
        setUsers([]);
        return;
      }

      setAuthorized(true);

      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setUsers((data ?? []) as UserProfile[]);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert(
        'Unable to Load Users',
        'Please check your connection and Supabase permissions.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('events')
      .select('id, event_code, title, start_time, end_time, created_by, created_at, status')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to load events:', error);
      Alert.alert('Events Unavailable', 'Could not load events. Check your Supabase permissions and try again.');
      return;
    }

    setEvents((data ?? []) as AdminEvent[]);
  }, []);

  const formatPickerValue = (value: string) => {
    if (!value) return 'Choose date and time';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Choose date and time';
    return date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const openDateTimePicker = (target: 'start' | 'end') => {
    const currentValue = target === 'start' ? eventStart : eventEnd;
    const parsed = currentValue ? new Date(currentValue) : new Date();
    setPickerValue(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    setDatePickerTarget(target);
    setPickerStage('date');
  };

  const handleDateTimeChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (event.type === 'dismissed') {
      setDatePickerTarget(null);
      return;
    }
    if (!selectedDate) return;
    setPickerValue(selectedDate);
    if (pickerStage === 'date') {
      // Android closes the native picker after each selection, so move on to time.
      setPickerStage('time');
      return;
    }
    const value = selectedDate.toISOString();
    if (datePickerTarget === 'start') setEventStart(value);
    if (datePickerTarget === 'end') setEventEnd(value);
    setDatePickerTarget(null);
  };

  const openCreateEvent = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventCode('');
    setEventStart('');
    setEventEnd('');
    setEventModalVisible(true);
  };

  const openEditEvent = (event: AdminEvent) => {
    setEditingEventId(event.id);
    setEventTitle(event.title);
    setEventCode(event.event_code);
    setEventStart(event.start_time ?? '');
    setEventEnd(event.end_time ?? '');
    setEventModalVisible(true);
  };

  const saveEvent = async () => {
    const title = eventTitle.trim();
    const code = eventCode.trim();
    const start = eventStart.trim();
    const end = eventEnd.trim();

    if (!title || !code) {
      Alert.alert('Missing Information', 'Enter both an event title and event code.');
      return;
    }
    if (start && Number.isNaN(Date.parse(start))) {
      Alert.alert('Invalid Start Time', 'Enter a valid date/time, for example 2026-10-25T09:00:00+08:00.');
      return;
    }
    if (end && Number.isNaN(Date.parse(end))) {
      Alert.alert('Invalid End Time', 'Enter a valid date/time, for example 2026-10-25T11:00:00+08:00.');
      return;
    }
    if (start && end && Date.parse(end) <= Date.parse(start)) {
      Alert.alert('Invalid Schedule', 'End time must be later than start time.');
      return;
    }

    setSavingEvent(true);
    try {
      if (editingEventId) {
        const { error } = await supabase.from('events').update({
          title,
          event_code: code,
          start_time: start ? new Date(start).toISOString() : null,
          end_time: end ? new Date(end).toISOString() : null,
        }).eq('id', editingEventId);
        if (error) throw error;
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) throw new Error('You must be signed in to create an event.');
        const { error } = await supabase.from('events').insert({
          title,
          event_code: code,
          start_time: start ? new Date(start).toISOString() : null,
          end_time: end ? new Date(end).toISOString() : null,
          created_by: authData.user.id,
          status: 'open',
        });
        if (error) throw error;
      }

      setEventModalVisible(false);
      await Promise.all([loadEvents(), loadStats(), loadReports()]);
      Alert.alert('Success', editingEventId ? 'Event updated.' : 'Event created.');
    } catch (error: any) {
      console.error('Failed to save event:', error);
      Alert.alert('Unable to Save Event', error?.message || 'Please check the event code and Supabase permissions.');
    } finally {
      setSavingEvent(false);
    }
  };

  const toggleEventStatus = (event: AdminEvent) => {
    const nextStatus = event.status === 'closed' ? 'open' : 'closed';
    Alert.alert(
      `${nextStatus === 'closed' ? 'Close' : 'Reopen'} Event`,
      `Are you sure you want to ${nextStatus === 'closed' ? 'close' : 'reopen'} “${event.title}”?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const { error } = await supabase.from('events').update({ status: nextStatus }).eq('id', event.id);
              if (error) throw error;
              await Promise.all([loadEvents(), loadStats(), loadReports()]);
              Alert.alert('Event Updated', `${event.title} is now ${nextStatus}.`);
            } catch (error: any) {
              console.error('Failed to change event status:', error);
              Alert.alert('Update Failed', error?.message || 'Could not update event status.');
            }
          },
        },
      ]
    );
  };

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);

    await Promise.all([
      loadUsers(),
      loadStats(),
      loadReports(),
      loadEvents(),
    ]);

    setRefreshing(false);
  }, [loadUsers, loadStats, loadReports, loadEvents]);

  useFocusEffect(
    useCallback(() => {
      void refreshDashboard();
    }, [refreshDashboard])
  );

  const changeRole = async (
    target: UserProfile,
    newRole: UserRole
  ) => {
    if (!user || updatingUserId) return;

    if (target.id === user.id) {
      Alert.alert('Not Allowed', 'You cannot change your own role.');
      return;
    }

    if (target.role === newRole) return;

    setUpdatingUserId(target.id);

    try {
      const { data, error } = await supabase.rpc(
        'admin_set_user_role',
        {
          target_user_id: target.id,
          new_role: newRole,
        }
      );

      if (error) throw error;

      const updated = data as {
        id: string;
        role: UserRole;
      } | null;

      if (!updated || updated.role !== newRole) {
        throw new Error('The server did not confirm the role change.');
      }

      setUsers((previous) =>
        previous.map((item) =>
          item.id === target.id
            ? { ...item, role: updated.role }
            : item
        )
      );

      Alert.alert(
        'Role Updated',
        `${target.full_name || target.email} is now ${newRole}.`
      );

      // Refresh counts if the role changed.
      void loadStats();
      void loadReports();
    } catch (error: any) {
      console.error('Failed to update role:', error);
      Alert.alert(
        'Role Update Failed',
        error?.message || 'Please try again.'
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  const confirmRoleChange = (
    target: UserProfile,
    newRole: UserRole
  ) => {
    Alert.alert(
      'Confirm Role Change',
      `Change ${target.full_name || target.email} from ${target.role} to ${newRole}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: () => void changeRole(target, newRole),
        },
      ]
    );
  };

  const showRoleOptions = (target: UserProfile) => {
    if (target.id === user?.id) {
      Alert.alert('Your Account', 'You cannot change your own role.');
      return;
    }

    Alert.alert(
      'Change User Role',
      `Choose a role for ${target.full_name || target.email}.`,
      [
        ...ROLES.filter((role) => role !== target.role).map((role) => ({
          text: `Set as ${role.charAt(0).toUpperCase()}${role.slice(1)}`,
          onPress: () => confirmRoleChange(target, role),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  };

  const studentCount = users.filter((item) => item.role === 'student').length;
  const teacherCount = users.filter((item) => item.role === 'teacher').length;
  const adminCount = users.filter((item) => item.role === 'admin').length;

  const selectedReport =
    reports.find((report) => report.event_id === selectedEventId) ?? null;

  const formatDate = (value: string | null) => {
    if (!value) return 'Not set';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return 'Invalid date';

    return date.toLocaleString();
  };

  const renderUser = ({ item }: { item: UserProfile }) => {
    const name = item.full_name?.trim() || 'Unnamed User';
    const isCurrentUser = item.id === user?.id;
    const isUpdating = updatingUserId === item.id;

    return (
      <View style={styles.userCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {name.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userName}>{name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>

          <View
            style={[
              styles.roleBadge,
              item.role === 'admin'
                ? styles.adminBadge
                : item.role === 'teacher'
                  ? styles.teacherBadge
                  : styles.studentBadge,
            ]}
          >
            <Text style={styles.roleText}>
              {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
            </Text>
          </View>

          {isCurrentUser ? (
            <Text style={styles.mutedText}>Your account</Text>
          ) : (
            <Pressable
              style={styles.changeRoleButton}
              onPress={() => showRoleOptions(item)}
              disabled={updatingUserId !== null}
            >
              {isUpdating ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Ionicons
                    name="person-outline"
                    size={17}
                    color={COLORS.primary}
                  />
                  <Text style={styles.changeRoleText}>Change Role</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.mutedText}>Loading Admin Dashboard...</Text>
      </View>
    );
  }

  if (!authorized) {
    return (
      <View style={styles.centered}>
        <Ionicons name="shield-outline" size={48} color={COLORS.textSecondary} />
        <Text style={styles.pageTitle}>Admin Access Required</Text>
        <Text style={styles.mutedText}>
          Sign in with an account assigned the Admin role.
        </Text>
        <Pressable style={styles.primaryButton} onPress={() => void refreshDashboard()}>
          <Text style={styles.primaryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={users}
      keyExtractor={(item) => item.id}
      renderItem={renderUser}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refreshDashboard()}
          tintColor={COLORS.primary}
        />
      }
      ListHeaderComponent={
        <View>
          <View style={styles.header}>
            <Text style={styles.pageTitle}>Admin Dashboard</Text>
          </View>

          <Pressable
            style={styles.attendanceOverviewButton}
            onPress={() => router.push('/admin-attendance')}
          >
            <View style={styles.attendanceOverviewIcon}>
              <Ionicons name="stats-chart-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.attendanceOverviewTextWrap}>
              <Text style={styles.attendanceOverviewTitle}>Overall Attendance</Text>
              <Text style={styles.attendanceOverviewSubtitle}>View attendance totals and event-by-event reports</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textSecondary} />
          </Pressable>

          <View style={styles.summaryCard}>
            <View style={styles.headingRow}>
              <Ionicons name="people" size={24} color={COLORS.primary} />
              <Text style={styles.cardTitle}>Total Registered Users</Text>
            </View>

            <Text style={styles.totalCount}>{users.length}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{studentCount}</Text>
                <Text style={styles.statLabel}>Students</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{teacherCount}</Text>
                <Text style={styles.statLabel}>Teachers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{adminCount}</Text>
                <Text style={styles.statLabel}>Admins</Text>
              </View>
            </View>
          </View>

          

          

          

          <View style={styles.eventSection}>
            <View style={styles.userManagementHeader}>
              <Text style={styles.sectionTitle}>Event Management</Text>
              
            </View>
            {events.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No events found</Text>
                <Text style={styles.mutedText}>Create an event to get started.</Text>
              </View>
            ) : events.map((event) => (
              <View style={styles.eventCard} key={event.id}>
                <View style={styles.eventCardTop}>
                  <View style={styles.eventTitleWrap}>
                    <Text style={styles.eventTitle}>{event.title}</Text>
                    <Text style={styles.mutedText}>Code: {event.event_code}</Text>
                  </View>
                  <View
                    style={[
                      styles.statusBadge,
                      event.status === 'closed' ? styles.closedBadge : styles.openBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        event.status === 'closed' ? styles.closedBadgeText : styles.openBadgeText,
                      ]}
                    >
                      {event.status === 'closed' ? 'CLOSED' : 'OPEN'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.mutedText}>Start: {formatDate(event.start_time)}</Text>
                <Text style={styles.mutedText}>End: {formatDate(event.end_time)}</Text>
                <View style={styles.eventActions}>
                  <Pressable style={styles.outlineButton} onPress={() => openEditEvent(event)}>
                    <Ionicons name="create-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.outlineButtonText}>Edit</Text>
                  </Pressable>
                  <Pressable style={styles.outlineButton} onPress={() => toggleEventStatus(event)}>
                    <Ionicons name={event.status === 'closed' ? 'lock-open-outline' : 'lock-closed-outline'} size={16} color={COLORS.primary} />
                    <Text style={styles.outlineButtonText}>{event.status === 'closed' ? 'Reopen' : 'Close Event'}</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>

          <Modal visible={eventModalVisible} animationType="slide" transparent onRequestClose={() => setEventModalVisible(false)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>{editingEventId ? 'Edit Event' : 'Create Event'}</Text>
                <Text style={styles.inputLabel}>Event title *</Text>
                <TextInput style={styles.input} value={eventTitle} onChangeText={setEventTitle} placeholder="e.g. Programming Seminar" placeholderTextColor={COLORS.textSecondary} />
                <Text style={styles.inputLabel}>Event code *</Text>
                <TextInput style={styles.input} value={eventCode} onChangeText={setEventCode} autoCapitalize="characters" placeholder="e.g. PROG2026" placeholderTextColor={COLORS.textSecondary} />
                <Text style={styles.inputLabel}>Start date and time (optional)</Text>
                <Pressable style={styles.dateTimeButton} onPress={() => openDateTimePicker('start')}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <Text style={eventStart ? styles.dateTimeValue : styles.dateTimePlaceholder}>{formatPickerValue(eventStart)}</Text>
                  {eventStart ? <Pressable hitSlop={8} onPress={() => setEventStart('')}><Ionicons name="close-circle" size={18} color={COLORS.textSecondary} /></Pressable> : null}
                </Pressable>
                <Text style={styles.inputLabel}>End date and time (optional)</Text>
                <Pressable style={styles.dateTimeButton} onPress={() => openDateTimePicker('end')}>
                  <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                  <Text style={eventEnd ? styles.dateTimeValue : styles.dateTimePlaceholder}>{formatPickerValue(eventEnd)}</Text>
                  {eventEnd ? <Pressable hitSlop={8} onPress={() => setEventEnd('')}><Ionicons name="close-circle" size={18} color={COLORS.textSecondary} /></Pressable> : null}
                </Pressable>
                <Text style={styles.inputHint}>Choose a date first, then choose the time. Times are saved as timestamps.</Text>
                <View style={styles.modalActions}>
                  <Pressable style={[styles.cancelButton, styles.modalActionButton]} onPress={() => setEventModalVisible(false)} disabled={savingEvent}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
                  <Pressable style={[styles.primaryButton, styles.modalActionButton]} onPress={() => void saveEvent()} disabled={savingEvent}>
                    {savingEvent ? <ActivityIndicator color={COLORS.textOnPrimary} /> : <Text style={styles.primaryButtonText}>Save Changes</Text>}
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>

          {datePickerTarget ? (
            <DateTimePicker
              value={pickerValue}
              mode={pickerStage}
              display="default"
              onChange={handleDateTimeChange}
              is24Hour={false}
            />
          ) : null}

          <View style={styles.userManagementHeader}>
            <Text style={styles.sectionTitle}>User Management</Text>
            <Pressable
              style={styles.refreshButton}
              onPress={() => void loadUsers()}
            >
              <Ionicons name="refresh" size={17} color={COLORS.primary} />
              <Text style={styles.refreshText}>Refresh</Text>
            </Pressable>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No users found</Text>
        </View>
      }
    />
  );
}

function Metric({
  title,
  value,
  icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  loading: boolean;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={23} color={COLORS.primary} />
      <Text style={styles.metricNumber}>{loading ? '—' : value}</Text>
      <Text style={styles.metricLabel}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  listContent: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 35,
  },
  centered: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    marginBottom: 20,
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
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 21,
  },
  attendanceOverviewButton: {
    backgroundColor: COLORS.card,
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 15,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attendanceOverviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendanceOverviewTextWrap: { flex: 1 },
  attendanceOverviewTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  attendanceOverviewSubtitle: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 3 },
  summaryCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 25,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  cardTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  totalCount: {
    fontSize: 30,
    fontWeight: '700',
    color: COLORS.primary,
    marginVertical: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 14,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 5,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    marginBottom: 25,
  },
  metricCard: {
    flex: 1,
    minWidth: 0,
    backgroundColor: COLORS.card,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 7,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricNumber: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginTop: 9,
  },
  metricLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportHeadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    padding: 6,
  },
  refreshText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  eventPicker: {
    gap: 8,
    paddingBottom: 14,
  },
  eventChip: {
    maxWidth: 200,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  eventChipSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  eventChipText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  eventChipTextSelected: {
    color: COLORS.textOnPrimary,
  },
  reportCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 15,
    marginBottom: 24,
  },
  reportEventTitle: {
    color: COLORS.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    marginBottom: 10,
  },
  mutedText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 19,
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 9,
  },
  percentageLabel: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  percentageValue: {
    color: COLORS.primary,
    fontSize: 21,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    backgroundColor: COLORS.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
    borderRadius: 6,
  },
  reportCounts: {
    flexDirection: 'row',
    gap: 30,
    marginTop: 16,
    marginBottom: 22,
  },
  reportCountNumber: {
    fontSize: 21,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  attendeesHeader: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 17,
    marginBottom: 10,
    gap: 5,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  attendeeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  attendeeInfo: {
    flex: 1,
  },
  attendeeName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  attendeeEmail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  scanTime: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 4,
  },
  noAttendees: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 22,
  },
  inlineLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 20,
  },
  emptyCard: {
    alignItems: 'center',
    padding: 22,
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 20,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 5,
  },
  eventSection: {
    marginBottom: 24,
  },
  eventCard: {
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  eventCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 8,
  },
  eventTitleWrap: { flex: 1 },
  eventTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
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
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  openBadgeText: { color: '#166534' },
  closedBadgeText: { color: '#991B1B' },
  eventActions: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  outlineButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: COLORS.primary, borderRadius: 9,
    paddingHorizontal: 11, paddingVertical: 8,
  },
  outlineButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: '700' },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center', padding: 18,
  },
  modalCard: {
    backgroundColor: COLORS.card, borderRadius: 18, padding: 20,
    maxHeight: '90%',
  },
  modalTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  inputLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11, color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
  },
  inputHint: { color: COLORS.textSecondary, fontSize: 11, marginTop: 8, lineHeight: 16 },
  dateTimeButton: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 46, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: COLORS.background },
  dateTimeValue: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  dateTimePlaceholder: { flex: 1, color: COLORS.textSecondary, fontSize: 14 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'stretch', gap: 10, marginTop: 20 },
  modalActionButton: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44, marginTop: 0 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border },
  cancelButtonText: { color: COLORS.textPrimary, fontWeight: '600' },
  userManagementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 12,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  userEmail: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 4,
    marginBottom: 9,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  adminBadge: {
    backgroundColor: COLORS.primary,
  },
  teacherBadge: {
    backgroundColor: COLORS.primary,
    opacity: 0.85,
  },
  studentBadge: {
    backgroundColor: COLORS.textSecondary,
  },
  roleText: {
    color: COLORS.textOnPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  changeRoleButton: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
    marginTop: 11,
  },
  changeRoleText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 18,
  },
  primaryButtonText: {
    color: COLORS.textOnPrimary,
    fontWeight: '700',
  },
});
