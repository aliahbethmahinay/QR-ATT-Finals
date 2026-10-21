import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  const [profileLoading, setProfileLoading] = useState(true);

  // Load the user's profile whenever the screen is focused.
  const loadProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setRole(null);
      setDraftName('');
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);

    try {
      const result = await getProfile(user.id);

      setRole(result?.role ?? null);
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
    } finally {
      setProfileLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  // Save the user's full name.
  const handleSaveName = async () => {
    if (!user || saving) return;

    const name = draftName.trim();

    if (!name) {
      Alert.alert(
        'Invalid Name',
        'Please enter your full name.'
      );
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

      Alert.alert(
        'Profile Updated',
        'Your name has been updated successfully.'
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.message ?? 'Unable to save your name.'
      );
    } finally {
      setSaving(false);
    }
  };

  // Cancel name editing without saving.
  const handleCancelEdit = () => {
    setDraftName(
      profile?.full_name ??
        user?.user_metadata?.full_name ??
        ''
    );

    setEditing(false);
  };

  // Sign out using the existing authentication function.
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

  const displayEmail =
    profile?.email ?? user?.email ?? 'No email';

  const normalizedRole = String(
    role ?? profile?.role ?? user?.user_metadata?.role ?? ''
  ).toLowerCase();

  const roleLabel =
    normalizedRole === 'admin'
      ? 'Administrator'
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
        : normalizedRole === 'student'
          ? styles.studentBadge
          : styles.unassignedBadge;

  const initials = getInitials(displayName);

  return (
    <KeyboardAvoidingView
      style={styles.keyboardContainer}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* PAGE HEADER */}

        <View style={styles.header}>
          <Text style={styles.eyebrow}>
            
          </Text>

          <Text style={styles.pageTitle}>
            My Profile
          </Text>

          
        </View>

        {profileLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text style={styles.loadingText}>
              Loading your profile...
            </Text>
          </View>
        ) : user ? (
          <>
            {/* PROFILE HERO */}

            <View style={styles.profileHero}>
              <View style={styles.heroTopRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {initials}
                  </Text>
                </View>

                <View style={styles.heroInfo}>
                  <Text
                    style={styles.heroName}
                    numberOfLines={2}
                  >
                    {displayName || 'Welcome!'}
                  </Text>

                  <Text
                    style={styles.heroEmail}
                    numberOfLines={2}
                  >
                    {displayEmail}
                  </Text>

                  <View
                    style={[
                      styles.roleBadge,
                      roleBadgeStyle,
                    ]}
                  >
                    <View style={styles.roleDot} />

                    <Text style={styles.roleBadgeText}>
                      {roleLabel}
                    </Text>
                  </View>
                </View>
              </View>

            </View>

            {/* ACCOUNT DETAILS */}

            

            <View style={styles.detailsCard}>
              {/* FULL NAME */}

              <View style={styles.fieldSection}>
                <View style={styles.fieldHeading}>
                  <View style={styles.fieldIcon}>
                    <Text style={styles.fieldIconText}>
                      ♙
                    </Text>
                  </View>

                  <Text style={styles.label}>
                    FULL NAME
                  </Text>
                </View>

                {editing ? (
                  <View style={styles.editContainer}>
                    <TextInput
                      value={draftName}
                      onChangeText={setDraftName}
                      style={styles.nameInput}
                      placeholder="Enter your full name"
                      placeholderTextColor={
                        COLORS.textSecondary
                      }
                      autoCapitalize="words"
                      autoCorrect={false}
                      editable={!saving}
                      returnKeyType="done"
                      onSubmitEditing={handleSaveName}
                      accessibilityLabel="Full name"
                    />

                    <View style={styles.editButtonRow}>
                      <Pressable
                        onPress={handleSaveName}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Save full name"
                        style={({ pressed }) => [
                          styles.saveButton,
                          pressed && styles.pressedButton,
                          saving && styles.disabledButton,
                        ]}
                      >
                        {saving ? (
                          <ActivityIndicator
                            size="small"
                            color={COLORS.textOnPrimary}
                          />
                        ) : (
                          <Text style={styles.saveButtonText}>
                            Save Changes
                          </Text>
                        )}
                      </Pressable>

                      <Pressable
                        onPress={handleCancelEdit}
                        disabled={saving}
                        accessibilityRole="button"
                        accessibilityLabel="Cancel editing name"
                        style={({ pressed }) => [
                          styles.cancelButton,
                          pressed && styles.pressedButton,
                          saving && styles.disabledButton,
                        ]}
                      >
                        <Text style={styles.cancelButtonText}>
                          Cancel
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                ) : (
                  <View style={styles.fieldValueRow}>
                    <Text
                      style={[
                        styles.fieldValue,
                        !displayName && styles.placeholderText,
                      ]}
                    >
                      {displayName || 'Name not provided'}
                    </Text>

                    <Pressable
                      onPress={() => {
                        setDraftName(displayName);
                        setEditing(true);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel="Edit full name"
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.editButton,
                        pressed && styles.pressedButton,
                      ]}
                    >
                      <Text style={styles.editButtonText}>
                        Edit
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>

              <View style={styles.divider} />

              {/* EMAIL */}

              <View style={styles.fieldSection}>
                <View style={styles.fieldHeading}>
                  <View style={styles.fieldIcon}>
                    <Text style={styles.fieldIconText}>
                      @
                    </Text>
                  </View>

                  <Text style={styles.label}>
                    EMAIL ADDRESS
                  </Text>
                </View>

                <Text style={styles.fieldValue}>
                  {displayEmail}
                </Text>

                
              </View>

              <View style={styles.divider} />

              {/* USER ID */}

              <View style={styles.fieldSection}>
                <View style={styles.fieldHeading}>
                  <View style={styles.fieldIcon}>
                    <Text style={styles.fieldIconText}>
                      #
                    </Text>
                  </View>

                  <Text style={styles.label}>
                    USER ID
                  </Text>
                </View>

                <Text style={styles.userIdValue}>
                  {profile?.id ?? user.id}
                </Text>

                
              </View>
            </View>

            {/* SIGN OUT */}

            <View style={styles.signOutCard}>
              <View style={styles.signOutInfo}>
                

                
              </View>

              <View style={styles.signOutButton}>
                <AppButton
                  title={
                    loading ? 'Signing out...' : 'Sign Out'
                  }
                  icon="log-out-outline"
                  onPress={handleSignOut}
                />
              </View>
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>!</Text>
            </View>

            <Text style={styles.emptyTitle}>
              No account information
            </Text>

            <Text style={styles.emptyDescription}>
              Please sign in again to view your profile.
            </Text>

            <Pressable
      onPress={handleSignOut}
      disabled={loading}
      style={styles.signOutButton}
    >
      <Text style={styles.signOutButtonText}>
        {loading ? 'Signing Out...' : 'Sign Out'}
      </Text>
    </Pressable>

          </View>
        )}

        <Text style={styles.footerText}>
          QR-ATT · School Event Attendance
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/*
 * GET USER INITIALS
 */

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'U';
  }

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

/*
 * STYLES
 */

const styles = StyleSheet.create({
  keyboardContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  contentContainer: {
    paddingHorizontal: 20,
    
    paddingBottom: 20,
  },

  header: {
    marginBottom: 24,
  },

  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.7,
    color: COLORS.primary,
    marginBottom: 7,
  },

  pageTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: -0.7,
    textAlign: 'center',
    marginTop: 20,

  },

  pageSubtitle: {
    fontSize: 14,
    lineHeight: 21,
    color: COLORS.textSecondary,
    marginTop: 7,
  },

  profileHero: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginBottom: 26,
    shadowColor: COLORS.shadow,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },

  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 60,
    height: 60,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 4,
    borderColor: COLORS.primaryLight,
  },

  avatarText: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
  },

  heroInfo: {
    flex: 1,
  },

  heroName: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  heroEmail: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: 4,
  },

  roleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 10,
  },

  roleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.textOnPrimary,
    marginRight: 6,
  },

  roleBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
  },

  adminBadge: {
    backgroundColor: COLORS.primaryDark,
  },

  teacherBadge: {
    backgroundColor: COLORS.primary,
  },

  studentBadge: {
    backgroundColor: COLORS.success,
  },

  unassignedBadge: {
    backgroundColor: COLORS.textSecondary,
  },

  heroDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginTop: 20,
    marginBottom: 14,
  },

  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.success,
    marginRight: 8,
  },

  heroFooterText: {
    flex: 1,
    fontSize: 11,
    color: COLORS.textSecondary,
  },

  secureLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: COLORS.primary,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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

  sectionIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },

  sectionIconText: {
    fontSize: 25,
    fontWeight: '700',
    color: COLORS.primary,
  },

  detailsCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
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

  fieldSection: {
    paddingVertical: 16,
  },

  fieldHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },

  fieldIcon: {
    width: 29,
    height: 29,
    borderRadius: 9,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },

  fieldIconText: {
    fontSize: 15,
    fontWeight: '800',
    color: COLORS.primary,
  },

  label: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: COLORS.textSecondary,
  },

  fieldValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },

  fieldValue: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },

  placeholderText: {
    color: COLORS.textSecondary,
    fontWeight: '400',
  },

  smallRoleBadge: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  smallRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textOnPrimary,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
  },

  editButton: {
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 10,
  },

  editButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.primary,
  },

  editContainer: {
    marginTop: 2,
  },

  nameInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 13,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.background,
    fontSize: 14,
  },

  editButtonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },

  saveButton: {
    flex: 1,
    minHeight: 44,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },

  saveButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 13,
    fontWeight: '800',
  },

  cancelButton: {
    minWidth: 90,
    minHeight: 44,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },

  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },

  pressedButton: {
    opacity: 0.75,
  },

  disabledButton: {
    opacity: 0.5,
  },

  helperText: {
    fontSize: 11,
    lineHeight: 17,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  userIdValue: {
    fontSize: 11,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },

  noticeCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    marginTop: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  noticeIcon: {
    width: 31,
    height: 31,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  noticeIconText: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.primary,
  },

  noticeTextContainer: {
    flex: 1,
  },

  noticeTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 5,
  },

  noticeDescription: {
    fontSize: 12,
    lineHeight: 19,
    color: COLORS.textSecondary,
  },

  signOutCard: {
    backgroundColor: COLORS.card,
    borderWidth: 0,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 0,
    marginTop: 10,
  },

  signOutInfo: {
    marginBottom: 1,
  },

  signOutTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },

  signOutSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginTop: 5,
  },

  signOutButton: {
    width: '100%',
    marginTop: 5,
    backgroundColor: COLORS.primary,
    paddingVertical: 1,
    paddingHorizontal: 1,
    borderRadius: 12,
    alignItems: 'center',
},

  signOutButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 15,
    fontWeight: '600',
  },

  loadingCard: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
  },

  loadingText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 14,
  },

  emptyCard: {
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    marginTop: 10,
  },

  emptyIcon: {
    width: 65,
    height: 65,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  emptyIconText: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'center',
  },

  emptyDescription: {
    fontSize: 13,
    lineHeight: 21,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  footerText: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 24,
  },
});