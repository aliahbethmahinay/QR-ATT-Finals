import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS } from '@/constants/colors';
import { useAuth } from '@/lib/auth';
import { getProfile } from '@/lib/profiles';
import { supabase } from '@/lib/supabase';

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

function formatDate(value: string | null) {
  if (!value) return 'Not set';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not set' : date.toLocaleString();
}

export default function AdminAttendanceScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [reports, setReports] = useState<AttendanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const loadReports = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setErrorMessage('');
    try {
      if (!user) {
        setAuthorized(false);
        setReports([]);
        return;
      }
      const profile = await getProfile(user.id);
      if (profile?.role !== 'admin') {
        setAuthorized(false);
        setReports([]);
        return;
      }
      setAuthorized(true);
      const { data, error } = await supabase.rpc('admin_get_attendance_reports');
      if (error) throw error;
      setReports(Array.isArray(data) ? data as AttendanceReport[] : []);
    } catch (error) {
      console.error('Unable to load overall attendance:', error);
      setErrorMessage('Attendance reports could not be loaded. Please check the Supabase report function and permissions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(useCallback(() => {
    void loadReports();
  }, [loadReports]));

  const totalRecords = reports.reduce((sum, item) => sum + (Number(item.attendee_count) || 0), 0);
  const totalStudents = reports.length ? Math.max(...reports.map((item) => Number(item.total_students) || 0)) : 0;
  const averageRate = reports.length
    ? Math.round(reports.reduce((sum, item) => sum + (Number(item.attendance_percentage) || 0), 0) / reports.length)
    : 0;

  if (loading) {
    return <View style={styles.centered}><Stack.Screen options={{ title: 'Overall Attendance' }} /><ActivityIndicator size="large" color={COLORS.primary} /><Text style={styles.muted}>Loading attendance reports…</Text></View>;
  }

  if (!authorized) {
    return <View style={styles.centered}><Stack.Screen options={{ title: 'Overall Attendance' }} /><Ionicons name="shield-outline" size={42} color={COLORS.textSecondary} /><Text style={styles.title}>Admin Access Required</Text><Text style={styles.muted}>Sign in with an account assigned the Admin role.</Text><Pressable style={styles.primaryButton} onPress={() => router.back()}><Text style={styles.primaryButtonText}>Go Back</Text></Pressable></View>;
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={reports}
      keyExtractor={(item) => item.event_id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadReports(true)} tintColor={COLORS.primary} />}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: 'Overall Attendance' }} />
          <Pressable style={styles.backButton} onPress={() => router.back()}><Ionicons name="arrow-back" size={19} color={COLORS.primary} /><Text style={styles.backText}>Admin Dashboard</Text></Pressable>
          
          {errorMessage ? <View style={styles.errorCard}><Text style={styles.errorText}>{errorMessage}</Text><Pressable onPress={() => void loadReports()}><Text style={styles.retryText}>Try again</Text></Pressable></View> : null}
          <Text style={styles.sectionTitle}>Attendance by Event</Text>
        </View>
      }
      ListEmptyComponent={<View style={styles.emptyCard}><Ionicons name="document-text-outline" size={30} color={COLORS.textSecondary} /><Text style={styles.emptyTitle}>No attendance reports yet</Text><Text style={styles.muted}>Reports will appear here when events and attendance records are available.</Text></View>}
      renderItem={({ item }) => {
        const expanded = expandedEventId === item.event_id;
        return <View style={styles.eventCard}>
          <Pressable onPress={() => setExpandedEventId(expanded ? null : item.event_id)} style={styles.eventHeader}>
            <View style={styles.eventIcon}><Ionicons name="calendar" size={19} color={COLORS.primary} /></View>
            <View style={styles.eventInfo}><Text style={styles.eventTitle}>{item.event_title || 'Untitled event'}</Text><Text style={styles.muted}>{item.attendee_count} attendance record{item.attendee_count === 1 ? '' : 's'} · {item.attendance_percentage ?? 0}%</Text></View>
            <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.textSecondary} />
          </Pressable>
          <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${Math.max(0, Math.min(100, Number(item.attendance_percentage) || 0))}%` }]} /></View>
          <Text style={styles.eventDate}>Starts: {formatDate(item.start_time)}</Text>
          <Text style={styles.eventDate}>Ends: {formatDate(item.end_time)}</Text>
          {expanded ? <View style={styles.attendeeList}>
            <Text style={styles.attendeeHeading}>Attendees ({item.attendees?.length ?? 0})</Text>
            {!item.attendees?.length ? <Text style={styles.muted}>No attendees recorded for this event.</Text> : item.attendees.map((attendee, index) => <View key={`${attendee.student_id}-${index}`} style={styles.attendeeRow}><View style={styles.avatar}><Ionicons name="person-outline" size={17} color={COLORS.primary} /></View><View style={styles.attendeeInfo}><Text style={styles.attendeeName}>{attendee.full_name?.trim() || 'Name unavailable'}</Text><Text style={styles.muted}>{attendee.email || 'No email available'}</Text><Text style={styles.scanTime}>Scanned: {formatDate(attendee.scanned_at)}</Text></View></View>)}
          </View> : null}
        </View>;
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 18, paddingBottom: 36 },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 25, fontWeight: '800', color: COLORS.textPrimary, marginTop: 8 },
  subtitle: { color: COLORS.textSecondary, fontSize: 14, marginTop: 5, marginBottom: 18 },
  muted: { color: COLORS.textSecondary, fontSize: 12, lineHeight: 18 },
  backButton: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'flex-start', marginBottom: 14, paddingVertical: 15 },
  backText: { color: COLORS.primary, fontSize: 13, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 25 },
  statCard: { flex: 1, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border, borderRadius: 15, padding: 15, gap: 7 },
  statValue: { color: COLORS.textPrimary, fontSize: 25, fontWeight: '800' },
  statLabel: { color: COLORS.textSecondary, fontSize: 12 },
  sectionTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: '800', marginBottom: 12 },
  eventCard: { backgroundColor: COLORS.card, borderColor: COLORS.border, borderWidth: 1, borderRadius: 15, padding: 15, marginBottom: 12 },
  eventHeader: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  eventIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center' },
  eventInfo: { flex: 1, gap: 4 },
  eventTitle: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '700' },
  progressTrack: { height: 6, borderRadius: 4, backgroundColor: COLORS.border, overflow: 'hidden', marginTop: 13, marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: COLORS.primary },
  eventDate: { color: COLORS.textSecondary, fontSize: 12, marginTop: 3 },
  attendeeList: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 14, paddingTop: 13 },
  attendeeHeading: { color: COLORS.textPrimary, fontSize: 14, fontWeight: '800', marginBottom: 10 },
  attendeeRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surface, alignItems: 'center', justifyContent: 'center' },
  attendeeInfo: { flex: 1, gap: 3 },
  attendeeName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: '700' },
  scanTime: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  emptyCard: { backgroundColor: COLORS.card, borderRadius: 15, borderWidth: 1, borderColor: COLORS.border, padding: 24, alignItems: 'center', gap: 9 },
  emptyTitle: { color: COLORS.textPrimary, fontSize: 16, fontWeight: '800' },
  errorCard: { backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, marginBottom: 20 },
  errorText: { color: COLORS.danger, fontSize: 13 },
  retryText: { color: COLORS.primary, fontWeight: '800', marginTop: 8 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 11, marginTop: 10 },
  primaryButtonText: { color: COLORS.textOnPrimary, fontWeight: '700' },
});
