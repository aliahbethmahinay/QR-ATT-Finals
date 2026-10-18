
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

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

  const [users, setUsers] = useState<UserProfile[]>([]);
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

  const refreshDashboard = useCallback(async () => {
    setRefreshing(true);

    await Promise.all([
      loadUsers(),
      loadStats(),
      loadReports(),
    ]);

    setRefreshing(false);
  }, [loadUsers, loadStats, loadReports]);

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
            <Text style={styles.subtitle}>
              Manage users, events, and attendance
            </Text>
          </View>

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
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 7,
    lineHeight: 21,
  },
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
    fontSize: 40,
    fontWeight: '700',
    color: COLORS.primary,
    marginVertical: 16,
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
