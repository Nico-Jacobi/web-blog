'use strict';

const path = require('path');
const fs = require('fs').promises;

const { VAPID } = require('../config');
const { blogRoot } = require('../utils/paths');

let webpush = null;
try {
  webpush = require('web-push');
  if (VAPID.publicKey && VAPID.privateKey) {
    webpush.setVapidDetails('mailto:' + VAPID.contact, VAPID.publicKey, VAPID.privateKey);
  } else {
    webpush = null;
  }
} catch {
  webpush = null;
}

function subsFile(blogId) {
  return path.join(blogRoot(blogId), 'push-subscriptions.json');
}

async function loadSubscriptions(blogId) {
  try {
    const data = await fs.readFile(subsFile(blogId), 'utf8');
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveSubscriptions(blogId, subs) {
  const file = subsFile(blogId);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(subs, null, 2));
}

async function addSubscription(blogId, sub) {
  if (!sub || !sub.endpoint) return false;
  const subs = await loadSubscriptions(blogId);
  if (subs.some(s => s.endpoint === sub.endpoint)) return false;
  subs.push(sub);
  await saveSubscriptions(blogId, subs);
  return true;
}

async function sendPushToBlogReaders(blogId, payload) {
  if (!webpush) return;
  const subs = await loadSubscriptions(blogId);
  if (subs.length === 0) return;
  const dead = [];
  await Promise.allSettled(subs.map(async (sub, i) => {
    try {
      await webpush.sendNotification(sub, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) dead.push(i);
    }
  }));
  if (dead.length) {
    const pruned = subs.filter((_, i) => !dead.includes(i));
    await saveSubscriptions(blogId, pruned);
  }
}

module.exports = {
  isAvailable: () => Boolean(webpush),
  loadSubscriptions,
  saveSubscriptions,
  addSubscription,
  sendPushToBlogReaders,
};
