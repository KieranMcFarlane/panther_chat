import { NextRequest, NextResponse } from 'next/server';

import { supabase } from '@/lib/supabase-client';
import {
  createDiscoveryEventResponse,
  publishDiscoveryEvent,
  seedDiscoveryEvents,
} from '@/lib/discovery-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type StoredDiscoveryEventRow = {
  event_data?: Record<string, unknown> | null;
  event_type?: string | null;
  priority?: string | null;
  created_at?: string | null;
};

function normalizeStoredEvent(row: StoredDiscoveryEventRow) {
  const eventData = row.event_data ?? {};
  return {
    type: String(row.event_type ?? eventData.type ?? 'system_status'),
    priority: String(row.priority ?? eventData.priority ?? 'MEDIUM').toUpperCase(),
    timestamp: String(row.created_at ?? eventData.timestamp ?? new Date().toISOString()),
    data: {
      ...(eventData && typeof eventData === 'object' ? eventData : {}),
      timestamp: String(row.created_at ?? eventData.timestamp ?? new Date().toISOString()),
      priority: String(row.priority ?? eventData.priority ?? 'MEDIUM').toUpperCase(),
    },
  };
}

async function seedRecentEventsFromStorage() {
  try {
    const { data } = await supabase
      .from('event_stream')
      .select('event_data, event_type, priority, created_at')
      .order('created_at', { ascending: false })
      .limit(25);

    if (!Array.isArray(data) || data.length === 0) {
      return;
    }

    seedDiscoveryEvents((data as StoredDiscoveryEventRow[]).map(normalizeStoredEvent).reverse());
  } catch (error) {
    console.warn('Failed to seed discovery events from storage', error);
  }
}

export async function GET(request: NextRequest) {
  await seedRecentEventsFromStorage();
  return createDiscoveryEventResponse(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const normalized = publishDiscoveryEvent({
      type: body.type || 'system_status',
      priority: body.priority || 'MEDIUM',
      timestamp: body.timestamp || new Date().toISOString(),
      data: body.data && typeof body.data === 'object' ? body.data : body,
    });

    await supabase.from('event_stream').insert({
      event_data: normalized,
      event_type: normalized.type,
      priority: normalized.priority,
      created_at: normalized.timestamp,
    });

    return NextResponse.json(
      {
        status: 'event_queued',
        event_id: `${normalized.type}_${Date.now()}`,
        event: normalized,
      },
      { status: 202 },
    );
  } catch (error) {
    console.error('Discovery event streaming POST error:', error);
    return NextResponse.json(
      { error: 'Failed to process discovery event' },
      { status: 500 },
    );
  }
}
