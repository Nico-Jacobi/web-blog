'use strict';

const express = require('express');
const { z } = require('zod');

const { resolveBlog, verifyReadPassword } = require('../middleware/authRead');
const { addSubscription } = require('../services/push');

const router = express.Router({ mergeParams: true });

router.use(resolveBlog);

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
}).passthrough();

router.post('/subscribe', verifyReadPassword, express.json(), async (req, res) => {
  const parsed = subscribeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid subscription' });
  try {
    const added = await addSubscription(req.targetBlog.id, parsed.data);
    res.json({ ok: true, added });
  } catch (err) {
    console.error(`SUBSCRIBE FAILED: ${err.message}`);
    res.status(500).json({ error: 'Subscribe failed' });
  }
});

module.exports = router;
