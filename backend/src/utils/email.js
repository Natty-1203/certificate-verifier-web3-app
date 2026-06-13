'use strict';

const nodemailer = require('nodemailer');
const logger     = require('./logger');

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;

    const host = process.env.SMTP_HOST;
    if (!host) {
        logger.warn('SMTP not configured — email sending is disabled');
        return null;
    }

    transporter = nodemailer.createTransport({
        host,
        port:  parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    return transporter;
}

async function sendEmail({ to, subject, html }) {
    const t = getTransporter();
    if (!t) {
        logger.info(`Email not sent (SMTP disabled): ${subject} -> ${to}`);
        return;
    }

    const from = process.env.SMTP_FROM || 'noreply@aastu.edu.et';
    try {
        await t.sendMail({ from, to, subject, html });
        logger.info(`Email sent: ${subject} -> ${to}`);
    } catch (err) {
        logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
}

function certificateIssuedEmail({ fullName, certificateID, studentID, department, graduationYear, verificationURL }) {
    return {
        subject: `Your AASTU Degree Certificate Has Been Issued — ${certificateID}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #1e3a8a; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">Addis Ababa Science & Technology University</h1>
                    <p style="margin: 8px 0 0; opacity: 0.9;">Secure Digital Certificate System</p>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Dear <strong>${fullName}</strong>,</p>
                    <p>Your academic degree certificate has been officially issued and recorded on the blockchain.</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Certificate ID</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold;">${certificateID}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Student ID</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${studentID}</td></tr>
                        <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb; color: #6b7280;">Department</td>
                            <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${department}</td></tr>
                        <tr><td style="padding: 8px; color: #6b7280;">Graduation Year</td>
                            <td style="padding: 8px;">${graduationYear}</td></tr>
                    </table>
                    <p>Verify your certificate anytime:</p>
                    <a href="${verificationURL}" style="display: inline-block; background: #1e3a8a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Verify Certificate</a>
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">This is an automated message from the AASTU SecureCert system.</p>
                </div>
            </div>
        `,
    };
}

function registrationConfirmationEmail({ username, studentID, fullName }) {
    return {
        subject: 'Welcome to AASTU SecureCert — Account Created',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background: #059669; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
                    <h1 style="margin: 0; font-size: 20px;">Addis Ababa Science & Technology University</h1>
                    <p style="margin: 8px 0 0; opacity: 0.9;">Student Self-Service Portal</p>
                </div>
                <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
                    <p>Dear <strong>${fullName || username}</strong>,</p>
                    <p>Your student portal account has been created successfully.</p>
                    <p>You can now log in to:</p>
                    <ul>
                        <li>View your issued digital certificates</li>
                        <li>Download verified PDF copies</li>
                        <li>Share your verification QR code</li>
                    </ul>
                    <p style="margin-top: 24px; font-size: 12px; color: #9ca3af;">If you did not create this account, please contact the registrar immediately.</p>
                </div>
            </div>
        `,
    };
}

module.exports = { sendEmail, certificateIssuedEmail, registrationConfirmationEmail };
