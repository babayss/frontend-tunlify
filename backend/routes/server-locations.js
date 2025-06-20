const express = require('express');
const supabase = require('../config/database');

const router = express.Router();

// Get all server locations
router.get('/', async (req, res) => {
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

module.exports = router;