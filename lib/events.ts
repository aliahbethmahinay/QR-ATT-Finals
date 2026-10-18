
import { supabase } from './supabase';

export type Event = {
  eventId: string;
  title: string;
  start: string;
  end: string;
};

export type CloudEvent = {
  id: string;
  event_code: string;
  title: string;
  start_time: string | null;
  end_time: string | null;
  created_by: string | null;
  created_at: string;
};

export type TeacherEventStat = {
  id: string;
  event_code: string;
  title: string;
  created_at: string;
  attendanceCount: number;
  attendancePercentage: number;
};

export type TeacherDashboardStats = {
  totalEvents: number;
  totalAttendanceRecords: number;
  totalRegisteredStudents: number;
  events: TeacherEventStat[];
};

/**
 * Create an event for the signed-in teacher.
 */
export async function createEvent(
  event: Event
): Promise<{ error: string | null }> {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error: 'You must be signed in to create an event.',
    };
  }

  const { error } = await supabase.from('events').insert({
    event_code: event.eventId,
    title: event.title,
    start_time: event.start || null,
    end_time: event.end || null,
    created_by: user.id,
  });

  return {
    error: error?.message ?? null,
  };
}

/**
 * Get events created by a specific teacher.
 */
export async function getEventsByTeacher(
  teacherId: string
): Promise<CloudEvent[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data as CloudEvent[];
}

/**
 * Find an event using its event code.
 */
export async function getEventByCode(
  code: string
): Promise<CloudEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('event_code', code)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as CloudEvent;
}

/**
 * Get the number of registered student accounts.
 * Uses the secure PostgreSQL function created in Step 1.
 */
export async function getRegisteredStudentCount(): Promise<{
  count: number | null;
  error: string | null;
}> {
  const { data, error } = await supabase.rpc(
    'count_registered_students'
  );

  if (error) {
    return {
      count: null,
      error: error.message,
    };
  }

  const count = Number(data);

  if (!Number.isSafeInteger(count) || count < 0) {
    return {
      count: null,
      error: 'The registered student count is invalid.',
    };
  }

  return {
    count,
    error: null,
  };
}

/**
 * Get attendance statistics for events created by a teacher.
 */
export async function getTeacherDashboardStats(
  teacherId: string
): Promise<{
  data: TeacherDashboardStats | null;
  error: string | null;
}> {
  // Fetch events belonging to this teacher.
  const { data: eventRows, error: eventsError } = await supabase
    .from('events')
    .select('id, event_code, title, created_at')
    .eq('created_by', teacherId)
    .order('created_at', { ascending: false });

  if (eventsError) {
    return {
      data: null,
      error: eventsError.message,
    };
  }

  // Fetch the expected number of students.
  const studentResult = await getRegisteredStudentCount();

  if (studentResult.error || studentResult.count === null) {
    return {
      data: null,
      error:
        studentResult.error ??
        'Unable to retrieve the registered student count.',
    };
  }

  const totalRegisteredStudents = studentResult.count;
  const events = eventRows ?? [];

  // If no events exist, return valid empty statistics.
  if (events.length === 0) {
    return {
      data: {
        totalEvents: 0,
        totalAttendanceRecords: 0,
        totalRegisteredStudents,
        events: [],
      },
      error: null,
    };
  }

  const eventIds = events.map((event) => event.id);

  // Retrieve attendance records for the teacher's events.
  const { data: attendanceRows, error: attendanceError } =
    await supabase
      .from('attendance')
      .select('id, event_id')
      .in('event_id', eventIds);

  if (attendanceError) {
    return {
      data: null,
      error: attendanceError.message,
    };
  }

  const attendance = attendanceRows ?? [];
  const countsByEvent = new Map<string, number>();

  for (const record of attendance) {
    countsByEvent.set(
      record.event_id,
      (countsByEvent.get(record.event_id) ?? 0) + 1
    );
  }

  // Calculate each event's attendance percentage.
  const eventStats: TeacherEventStat[] = events.map((event) => {
    const attendanceCount = countsByEvent.get(event.id) ?? 0;

    const attendancePercentage =
      totalRegisteredStudents > 0
        ? Math.round(
            (attendanceCount / totalRegisteredStudents) * 100
          )
        : 0;

    return {
      ...event,
      attendanceCount,
      attendancePercentage,
    };
  });

  return {
    data: {
      totalEvents: events.length,
      totalAttendanceRecords: attendance.length,
      totalRegisteredStudents,
      events: eventStats,
    },
    error: null,
  };
}
