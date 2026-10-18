import { supabase } from './supabase';
import { parseQRPayload } from './qr';
import { getEventByCode } from './events';

/*
 * ==========================================
 * TEACHER EVENT ATTENDANCE
 * ==========================================
 */

export type TeacherEventAttendance = {
  eventId: string;
  eventCode: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  attendeeCount: number;

  attendees: {
    studentId: string;
    studentName: string;
    scannedAt: string;
  }[];
};

export async function getTeacherEventAttendance(
  teacherId: string
): Promise<TeacherEventAttendance[]> {
  /*
   * Get all events created by this teacher
   */
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title, start_time, end_time'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.error(
      'Error loading teacher events:',
      eventError
    );

    return [];
  }

  if (events.length === 0) {
    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  /*
   * Get attendance records for the teacher's events
   */
  const {
    data: attendance,
    error: attError,
  } = await supabase
    .from('attendance')
    .select(
      'student_id, scanned_at, event_id'
    )
    .in('event_id', eventIds)
    .order('scanned_at', {
      ascending: false,
    });

  if (attError || !attendance) {
    console.error(
      'Error loading attendance:',
      attError
    );

    return [];
  }

  /*
   * Get the names of students who scanned
   */
  const studentIds = [
    ...new Set(
      attendance.map(
        (row: any) => row.student_id
      )
    ),
  ];

  const nameByStudentId: Record<string, string> = {};

  if (studentIds.length > 0) {
    const {
      data: profiles,
      error: profileError,
    } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', studentIds);

    if (profileError) {
      console.error(
        'Error loading student names:',
        profileError
      );
    } else {
      profiles?.forEach((profile: any) => {
        nameByStudentId[profile.id] =
          profile.full_name?.trim() || '';
      });
    }
  }

  /*
   * Combine events, attendance, and student names
   */
  return events.map((event: any) => {
    const rows = attendance.filter(
      (row: any) =>
        row.event_id === event.id
    );

    return {
      eventId: event.id,
      eventCode: event.event_code,
      title: event.title,

      startTime:
        event.start_time ?? null,

      endTime:
        event.end_time ?? null,

      attendeeCount: rows.length,

      attendees: rows.map(
        (row: any) => ({
          studentId: row.student_id,

          studentName:
            nameByStudentId[row.student_id] ||
            'Name unavailable',

          scannedAt: row.scanned_at,
        })
      ),
    };
  });
}

/*
 * ==========================================
 * STUDENT ATTENDANCE RECORD
 * ==========================================
 */

export type AttendanceRecord = {
  id: string;
  eventId: string;
  eventTitle: string;
  scannedAt: string;
};

/*
 * ==========================================
 * REGISTER ATTENDANCE
 * ==========================================
 */

export type RegisterResult = {
  success: boolean;
  message: string;
  eventTitle?: string;
};

export async function registerAttendance(
  rawPayload: string,
  studentId: string
): Promise<RegisterResult> {
  /*
   * Parse QR code
   */
  const result = parseQRPayload(rawPayload);

  if (!result.ok) {
    return {
      success: false,
      message: result.message,
    };
  }

  const payload = result.payload;

  /*
   * Check event start and end times
   */
  const now = Date.now();

  const start = payload.start
    ? new Date(payload.start).getTime()
    : null;

  const end = payload.end
    ? new Date(payload.end).getTime()
    : null;

  if (start && now < start) {
    return {
      success: false,
      message: 'Event has not started yet.',
    };
  }

  if (end && now > end) {
    return {
      success: false,
      message: 'Event has already ended.',
    };
  }

  /*
   * Event title
   */
  const title =
    payload.title ?? payload.event;

  /*
   * Look for the existing event
   */
  let event: {
    id: string;
    title: string;
  } | null = null;

  const foundEvent = await getEventByCode(
    payload.event
  );

  if (foundEvent) {
    event = foundEvent;
  } else {
    /*
     * Create event if it does not exist
     */
    const {
      data: newEvent,
      error: insertError,
    } = await supabase
      .from('events')
      .insert([
        {
          event_code: payload.event,
          title,
          start_time: payload.start ?? null,
          end_time: payload.end ?? null,
        },
      ])
      .select('id, title')
      .single();

    if (insertError || !newEvent) {
      console.error(
        'Could not create event:',
        insertError
      );

      return {
        success: false,
        message: 'Could not create event.',
      };
    }

    event = newEvent;
  }

  /*
   * Register student attendance
   */
  const {
    error: attError,
  } = await supabase
    .from('attendance')
    .insert([
      {
        student_id: studentId,
        event_id: event.id,
      },
    ]);

  if (attError) {
    /*
     * Duplicate attendance
     */
    if (attError.code === '23505') {
      return {
        success: false,
        message:
          'Already registered for this event.',
        eventTitle: event.title,
      };
    }

    return {
      success: false,
      message: attError.message,
    };
  }

  return {
    success: true,
    message: 'Attendance recorded!',
    eventTitle: event.title,
  };
}

/*
 * ==========================================
 * STUDENT HISTORY
 * ==========================================
 */

export async function getAttendanceHistory(
  studentId: string
): Promise<AttendanceRecord[]> {
  const {
    data,
    error,
  } = await supabase
    .from('attendance')
    .select(
      'id, scanned_at, events ( event_code, title )'
    )
    .eq('student_id', studentId)
    .order('scanned_at', {
      ascending: false,
    });

  if (error || !data) {
    console.error(
      'Error loading student history:',
      error
    );

    return [];
  }

  return data.map((row: any) => ({
    id: row.id,

    eventId:
      row.events?.event_code ?? '',

    eventTitle:
      row.events?.title ?? '',

    scannedAt: row.scanned_at,
  }));
}

/*
 * ==========================================
 * TEACHER EVENT SUMMARY
 * ==========================================
 */

export type TeacherEventSummary = {
  eventId: string;
  eventCode: string;
  title: string;
  attendeeCount: number;
};

export async function getTeacherEventSummary(
  teacherId: string
): Promise<TeacherEventSummary[]> {
  const {
    data: events,
    error: eventError,
  } = await supabase
    .from('events')
    .select(
      'id, event_code, title'
    )
    .eq('created_by', teacherId)
    .order('created_at', {
      ascending: false,
    });

  if (eventError || !events) {
    console.error(
      'Error loading teacher event summary:',
      eventError
    );

    return [];
  }

  const eventIds = events.map(
    (event: any) => event.id
  );

  if (eventIds.length === 0) {
    return [];
  }

  const {
    data: attRows,
    error: attError,
  } = await supabase
    .from('attendance')
    .select('event_id')
    .in('event_id', eventIds);

  if (attError || !attRows) {
    console.error(
      'Error loading attendance summary:',
      attError
    );

    return [];
  }

  const counts: Record<string, number> = {};

  attRows.forEach((row: any) => {
    counts[row.event_id] =
      (counts[row.event_id] ?? 0) + 1;
  });

  return events.map((event: any) => ({
    eventId: event.id,
    eventCode: event.event_code,
    title: event.title,
    attendeeCount:
      counts[event.id] ?? 0,
  }));
}
