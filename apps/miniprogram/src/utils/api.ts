import { getToken } from './storage';
import type { FeedbackResponse } from '@roselet/core';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001';

export async function submitFeedback(content: string): Promise<{ success: boolean; error?: string }> {
  try {
    const token = getToken();
    const res = await fetch(`${API_BASE}/api/feedback`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ content }),
    });

    if (res.ok) {
      const data: FeedbackResponse = await res.json();
      return { success: true };
    } else {
      const error = await res.text();
      return { success: false, error: error || 'Failed to submit feedback' };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}