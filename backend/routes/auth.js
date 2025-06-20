const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const supabase = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { sendOTPEmail } = require('../utils/email');

const router = express.Router();

// Check if email is disabled
const isEmailDisabled = process.env.DISABLE_EMAIL === 'true';

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 }),
  body('name').trim().isLength({ min: 2 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password, name } = req.body;

    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(409).json({ message: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const { data: newUser, error: userError } = await supabase
      .from('users')
      .insert([{
        email,
        password_hash: hashedPassword,
        name,
        role: 'user',
        is_verified: isEmailDisabled // Auto verify if email disabled
      }])
      .select()
      .single();

    if (userError) {
      console.error('User creation error:', userError);
      return res.status(500).json({ message: 'Failed to create user' });
    }

    // If email is disabled, return success immediately
    if (isEmailDisabled) {
      console.log('📧 Email disabled - User auto-verified:', email);
      return res.status(201).json({
        message: 'User created and verified successfully (email disabled)',
        userId: newUser.id,
        autoVerified: true
      });
    }

    // Generate OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Store OTP
    const { error: otpError } = await supabase
      .from('otp_tokens')
      .insert([{
        user_id: newUser.id,
        token: otp,
        expires_at: expiresAt.toISOString(),
        verified: false
      }]);

    if (otpError) {
      console.error('OTP creation error:', otpError);
    }

    // Send OTP email
    try {
      await sendOTPEmail(email, otp, name);
      
      res.status(201).json({
        message: 'User created successfully. Please check your email for OTP.',
        userId: newUser.id
      });
    } catch (emailError) {
      console.error('Failed to send OTP email:', emailError);
      
      // If email fails, auto-verify user and continue
      await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', newUser.id);
      
      res.status(201).json({
        message: 'User created successfully. Email service unavailable - account auto-verified.',
        userId: newUser.id,
        autoVerified: true,
        emailError: 'Email service temporarily unavailable'
      });
    }

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Verify OTP
router.post('/verify-otp', [
  body('email').isEmail().normalizeEmail(),
  body('otp').isLength({ min: 6, max: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, otp } = req.body;

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, is_verified')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // If already verified, return success
    if (user.is_verified) {
      return res.json({ message: 'Email already verified' });
    }

    // If email is disabled, auto-verify
    if (isEmailDisabled) {
      await supabase
        .from('users')
        .update({ is_verified: true })
        .eq('id', user.id);
      
      return res.json({ message: 'Email verified successfully (auto-verified)' });
    }

    // Find valid OTP
    const { data: otpToken, error: otpError } = await supabase
      .from('otp_tokens')
      .select('*')
      .eq('user_id', user.id)
      .eq('token', otp)
      .eq('verified', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (otpError || !otpToken) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    // Mark user as verified
    const { error: updateUserError } = await supabase
      .from('users')
      .update({ is_verified: true })
      .eq('id', user.id);

    if (updateUserError) {
      return res.status(500).json({ message: 'Failed to verify user' });
    }

    // Mark OTP as used
    await supabase
      .from('otp_tokens')
      .update({ verified: true })
      .eq('id', otpToken.id);

    res.json({ message: 'Email verified successfully' });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Login
router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Validation failed', 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if verified (skip if email disabled)
    if (!isEmailDisabled && !user.is_verified) {
      return res.status(401).json({ message: 'Please verify your email first' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Generate JWT
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Return user data (without password)
    const { password_hash, ...userWithoutPassword } = user;

    res.json({
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

module.exports = router;
