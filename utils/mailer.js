import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const transporter = nodemailer.createTransport({
  service: 'gmail', // Hoặc service email của bạn
  auth: {
    user: process.env.EMAIL_USER, 
    pass: process.env.EMAIL_PASS, 
  },
});

export const sendMail = async (email, code) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Mã xác thực đăng ký Forum',
    html: `
      <h2>Xác thực đăng ký tài khoản</h2>
      <p>Mã xác thực (OTP) của bạn là:</p>
      <h1 style="color: #007bff; font-size: 30px; letter-spacing: 3px;">${code}</h1>
      <p>Mã này sẽ hết hạn trong 10 phút.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
};

