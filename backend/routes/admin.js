const express = require('express');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('id, email, name, role, is_verified, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Get users error:', error);
      return res.status(500).json({ message: 'Failed to fetch users' });
    }

    res.json(users);
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get all server locations
router.get('/server-locations', async (req, res) => {
  try {
    const { data: locations, error } = await supabase
      .from('server_locations')
      .select('*')
      .order('name');

    if (error) {
      console.error('Get server locations error:', error);
      return res.status(500).json({ message: 'Failed to fetch server locations' });
    }

    res.json(locations);
  } catch (error) {
    console.error('Get server locations error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Add server location
router.post('/server-locations', [
  body('name').trim().isLength({ min: 2 }),
  body('region_code').trim().isLength({ min: 2, max: 10 }),
  body('ip_address').isIP()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { name, region_code, ip_address } = req.body;

    // Check if region code already exists
    const { data: existing } = await supabase
      .from('server_locations')
      .select('id')
      .eq('region_code', region_code)
      .single();

    if (existing) {
      return res.status(409).json({ message: 'Region code already exists' });
    }

    const { data: newLocation, error } = await supabase
      .from('server_locations')
      .insert([{ name, region_code, ip_address }])
      .select()
      .single();

    if (error) {
      console.error('Add server location error:', error);
      return res.status(500).json({ message: 'Failed to add server location' });
    }

    res.status(201).json(newLocation);

  } catch (error) {
    console.error('Add server location error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get content pages
router.get('/content', async (req, res) => {
  try {
    const { data: content, error } = await supabase
      .from('content_pages')
      .select('*')
      .order('type')
      .order('lang');

    if (error) {
      console.error('Get content error:', error);
      return res.status(500).json({ message: 'Failed to fetch content' });
    }

    res.json(content);
  } catch (error) {
    console.error('Get content error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get settings
router.get('/settings', async (req, res) => {
  try {
    const { data: settings, error } = await supabase
      .from('admin_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Get settings error:', error);
      return res.status(500).json({ message: 'Failed to fetch settings' });
    }

    res.json(settings || { google_client_id: null });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Update settings
router.post('/settings', [
  body('google_client_id').optional().trim()
], async (req, res) => {
  try {
    const { google_client_id } = req.body;

    // Check if settings exist
    const { data: existing } = await supabase
      .from('admin_settings')
      .select('id')
      .limit(1)
      .single();

    if (!existing) {
      // Create new settings
      const { error } = await supabase
        .from('admin_settings')
        .insert([{ google_client_id }]);

      if (error) {
        console.error('Create settings error:', error);
        return res.status(500).json({ message: 'Failed to create settings' });
      }
    } else {
      // Update existing settings
      const { error } = await supabase
        .from('admin_settings')
        .update({ google_client_id })
        .eq('id', existing.id);

      if (error) {
        console.error('Update settings error:', error);
        return res.status(500).json({ message: 'Failed to update settings' });
      }
    }

    res.json({ message: 'Settings updated successfully' });

  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;