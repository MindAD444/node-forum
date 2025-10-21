const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error, success) => {
  if (error) console.error('❌ Lỗi SMTP:', error);
  else console.log('✅ SMTP hoạt động:', success);
});

async function sendVerificationEmail(to, code) {
  console.log('📨 Gửi mã tới:', to, 'Mã:', code);
  try {
    const info = await transporter.sendMail({
      from: `"Forum" <${process.env.EMAIL_USER}>`,
      to,
      subject: 'Mã xác thực tài khoản Forum',
      text: `Mã xác thực của bạn là ${code}`,
    });
    console.log('✅ Email sent:', info.response);
  } catch (err) {
    console.error('❌ Lỗi gửi mail:', err);
    throw err;
  }
}

module.exports = sendVerificationEmail;
