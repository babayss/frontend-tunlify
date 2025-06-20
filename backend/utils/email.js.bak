const nodemailer = require('nodemailer');

// Create transporter (fixed: createTransport, bukan createTransporter)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const sendOTPEmail = async (email, otp, name) => {
  const mailOptions = {
    from: `"Tunlify" <${process.env.SMTP_USER}>`,
    to: email,
    subject: 'Verify Your Email - Tunlify',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Tunlify</h1>
        </div>
        
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hi ${name}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for registering with Tunlify. To complete your registration, 
            please verify your email address using the OTP code below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="background: #667eea; color: white; padding: 15px 30px; border-radius: 8px; font-size: 24px; font-weight: bold; letter-spacing: 3px; display: inline-block;">
              ${otp}
            </div>
          </div>
          
          <p style="color: #666; line-height: 1.6;">
            This code will expire in 5 minutes. If you didn't request this verification, 
            please ignore this email.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p style="color: #999; font-size: 12px;">
              Best regards,<br>
              The Tunlify Team
            </p>
          </div>
        </div>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

module.exports = { sendOTPEmail };