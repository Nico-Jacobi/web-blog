'use strict';

const { z } = require('zod');

const themeSchema = z.object({
  primary: z.string().max(32).optional(),
  accent: z.string().max(32).optional(),
}).strict().optional();

const pushSchema = z.object({
  notificationText: z.string().max(280).optional(),
}).strict().optional();

const blogSettingsSchema = z.object({
  title: z.string().min(1).max(120),
  subtitle: z.string().max(280).optional(),
  dateRange: z.string().max(120).optional(),
  language: z.enum(['de', 'en']).optional(),
  ownerDisplayName: z.string().max(120).optional(),
  theme: themeSchema,
  push: pushSchema,
}).strict();

const blogSettingsPatchSchema = blogSettingsSchema.partial();

const DEFAULT_SETTINGS = {
  title: 'My Blog',
  language: 'de',
  theme: { primary: 'orange', accent: 'slate' },
  push: { notificationText: '{owner} hat etwas Neues gepostet!' },
};

function withDefaults(settings) {
  const merged = { ...DEFAULT_SETTINGS, ...(settings || {}) };
  merged.theme = { ...DEFAULT_SETTINGS.theme, ...(settings?.theme || {}) };
  merged.push = { ...DEFAULT_SETTINGS.push, ...(settings?.push || {}) };
  return merged;
}

function parseSettingsJson(json) {
  if (!json) return {};
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

module.exports = {
  blogSettingsSchema,
  blogSettingsPatchSchema,
  DEFAULT_SETTINGS,
  withDefaults,
  parseSettingsJson,
};
