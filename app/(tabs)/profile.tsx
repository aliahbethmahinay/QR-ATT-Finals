
import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import AppButton from '@/components/AppButton';
import { COLORS } from '@/constants/colors';
import { useAuth, signOut } from '@/lib/auth';
import { getProfile, type Role } from '@/lib/profiles';
import { updateProfile, type Profile } from '@/lib/profiles';

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [draftName, setDraftName] = useState('');
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load the profile and role whenever this screen is focused.
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRole(null);
      return;
    }

    try {
      const result = await getProfile(user.id);

      setRole(result?.role ?? null);

      // Preserve the existing profile information while using
      // the role returned by the same function as the tab layout.
      setProfile(
        result
          ? ({ ...result, role: result.role } as Profile)
          : null
      );

      setDraftName(
        result?.full_name ??
          user.user_metadata?.full_name ??
          ''
      );
    } catch (error) {
      console.error('Error loading profile:', error);
      setRole(null);
      setDraftName(user.user_metadata?.full_name ?? '');
      Alert.alert(
        'Profile Error',
        'Unable to load your profile. Please try again.'
      );
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Save the user's full name.
  const handleSaveName = async () => {
    if (!user) return;

    const name = draftName.trim();

    if (!name) {
      Alert.alert('Invalid Name', 'Please enter your full name.');
      return;
    }

    setSaving(true);

    try {
      const { error } = await updateProfile(user.id, {
        full_name: name,
      });

      if (error) {
        Alert.alert('Error', error);
        return;
      }

      setProfile((previous) =>
        previous
          ? { ...previous, full_name: name }
          : previous
      );

      setDraftName(name);
      setEditing(false);

      Alert.alert('Saved', 'Your name has been updated.');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message ?? 'Unable to save your name.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Sign out.
  const handleSignOut = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const { error } = await signOut();

      if (error) {
        Alert.alert('Sign Out Failed', error);
        return;
      }

      router.replace('/login');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message ?? 'Failed to sign out.'
      );
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    profile?.full_name ??
    user?.user_metadata?.full_name ??
    '';

  const displayEmail = profile?.email ?? user?.email ?? 'No email';

  const normalizedRole = String(
    role ?? profile?.role ?? user?.user_metadata?.role ?? ''
  ).toLowerCase();

  const roleLabel =
    normalizedRole === 'admin'
      ? 'Admin'
      : normalizedRole === 'teacher'
        ? 'Teacher'
        : normalizedRole === 'student'
          ? 'Student'
          : 'Role Not Assigned';

  const roleBadgeStyle =
    normalizedRole === 'admin'
      ? styles.adminBadge
      : normalizedRole === 'teacher'
        ? styles.teacherBadge
        : styles.studentBadge;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Profile</Text>
        <Text style={styles.subtitle}>
          Manage your account information
        </Text>
      </View>

      {user && (
        <View style={styles.card}>
          <View style={styles.accountHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {displayName ? displayName.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>

            <View style={styles.accountInfo}>
              <Text style={styles.accountTitle}>
                Account Information
              </Text>
              <Text style={styles.accountSubtitle}>
                Your registered details
              </Text>
            </View>
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.label}>Role</Text>
            <View style={[styles.roleBadge, roleBadgeStyle]}>
              <Text style={styles.roleBadgeText}>{roleLabel}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.fieldSection}>
            <Text style={styles.label}>Full Name</Text>

            {editing ? (
              <View>
                <TextInput
                  value={draftName}
                  onChangeText={setDraftName}
                  style={styles.nameInput}
                  placeholder="Enter your full name"
                  placeholderTextColor={COLORS.textSecondary}
                  autoCapitalize="words"
                  editable={!saving}
                />

                <View style={styles.editButtonRow}>
                  <Pressable
                    onPress={handleSaveName}
                    disabled={saving}
                    style={[
                      styles.saveButton,
                      saving && styles.disabledButton,
                    ]}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => setEditing(false)}
                    disabled={saving}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.cancelButtonText}>
                      Cancel
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setEditing(true)}
                style={styles.nameDisplay}
              >
                <Text
                  style={[
                    styles.value,
                    !displayName && styles.placeholderText,
                  ]}
                  numberOfLines={1}
                >
                  {displayName || 'Tap to add your name'}
                </Text>

                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.value} numberOfLines={1}>
                {displayEmail}
              </Text>
            </View>
          </View>

          <View style={styles.fieldSection}>
            <Text style={styles.label}>User ID</Text>
            <View style={styles.readOnlyField}>
              <Text style={styles.idValue} numberOfLines={1}>
                {profile?.id ?? user.id}
              </Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.signOutContainer}>
        <AppButton
          title={loading ? 'Signing out...' : 'Sign Out'}
          icon="log-out-outline"
          onPress={handleSignOut}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 17,
  },
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  accountInfo: {
    flex: 1,
  },
  accountTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  accountSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  fieldSection: {
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    marginBottom: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  value: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
    fontWeight: '500',
  },
  placeholderText: {
    color: COLORS.textSecondary,
  },
  readOnlyField: {
    minHeight: 39,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  idValue: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  adminBadge: {
    backgroundColor: '#47b0da',
  },
  teacherBadge: {
    backgroundColor: COLORS.primary,
  },
  studentBadge: {
    backgroundColor: COLORS.textSecondary,
  },
  roleBadgeText: {
    color: COLORS.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  nameDisplay: {
    minHeight: 39,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '700',
  },
  nameInput: {
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },
  editButtonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 7,
  },
  saveButton: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  signOutContainer: {
    marginTop: 14,
  },
});
